#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>

// ─── Konfigurasi ───────────────────────────────────────────
#define WIFI_SSID       "WF0"
#define WIFI_PASSWORD   "1sampai8"

#define MQTT_HOST       "umbulan.er-datamedia.com"
#define MQTT_PORT       1883
#define MQTT_USER       "esp32"
#define MQTT_PASS       "umbulan2026"
#define MQTT_TOPIC      "umbulan/sensors/esp32s3"
#define DEVICE_ID       "esp32s3-umbulan-01"

#define PUBLISH_INTERVAL_MS  10000

// ─── Feature flags ─────────────────────────────────────────
// Set true hanya kalau sensor sudah terpasang fisik dan siap dipakai
#define PH_SENSOR_CONNECTED   false   // aktifkan setelah pH-4502C disolder & dipasang
#define AJSR04M_ENABLED       false   // aktifkan setelah MT3608 diganti/solusi power selesai

// ─── Pin ───────────────────────────────────────────────────
// GPIO 17/18 aman — Octal PSRAM N16R8 pakai GPIO 33-37, bukan 17/18
#define PIN_DS18B20     16
#define PIN_PH          4
#define PIN_TURBIDITY   5
#define PIN_TRIG        17
#define PIN_ECHO        18
#define PIN_LED_POWER   38
#define PIN_LED_STATUS  39

// ─── Kalibrasi sensor ──────────────────────────────────────
#define ADC_VREF        3.3f
#define ADC_MAX         4095.0f

#define PH_NEUTRAL_V    1.65f
#define PH_SLOPE        0.18f

// Turbidity: VCC sementara dari pin 5V ESP32 (~3.5V terukur) bukan MT3608
// Nilai kalibrasi ini BELUM FINAL — akan dikalibrasi ulang setelah kembali ke base
// dengan VCC dari MT3608 (4.8V) sebagai power source final
#define TURB_V_CLEAR    4.2f
#define TURB_V_DIRTY    1.0f
#define TURB_NTU_MAX    3000.0f

#define SENSOR_HEIGHT_CM  100.0f

#define RATING_A        0.5f
#define RATING_B        1.5f

// ─── Objek ─────────────────────────────────────────────────
OneWire oneWire(PIN_DS18B20);
DallasTemperature ds18b20(&oneWire);
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

unsigned long lastPublish = 0;
bool ledStatusState = false;

// ─── Fungsi sensor ─────────────────────────────────────────

float readTemperature() {
    ds18b20.requestTemperatures();
    float t = ds18b20.getTempCByIndex(0);
    Serial.print("[DS18B20] Device count: ");
    Serial.println(ds18b20.getDeviceCount());
    Serial.print("[DS18B20] Raw temp: ");
    Serial.println(t);
    if (t == DEVICE_DISCONNECTED_C) return -999.0f;
    return t;
}

#if PH_SENSOR_CONNECTED
float readPH() {
    long sum = 0;
    for (int i = 0; i < 10; i++) {
        sum += analogRead(PIN_PH);
        delay(10);
    }
    float voltage = (sum / 10.0f) * (ADC_VREF / ADC_MAX);
    return 7.0f + ((PH_NEUTRAL_V - voltage) / PH_SLOPE);
}
#endif

float readTurbidityNTU() {
    int samples[10];
    for (int i = 0; i < 10; i++) {
        samples[i] = analogRead(PIN_TURBIDITY);
        delay(10);
    }
    // Sort, buang 2 terendah + 2 tertinggi, rata-rata 6 tengah
    for (int i = 1; i < 10; i++) {
        int key = samples[i], j = i - 1;
        while (j >= 0 && samples[j] > key) { samples[j + 1] = samples[j]; j--; }
        samples[j + 1] = key;
    }
    long sum = 0;
    for (int i = 2; i < 8; i++) sum += samples[i];
    float voltage = (sum / 6.0f) * (ADC_VREF / ADC_MAX);
    float ntu = TURB_NTU_MAX * (1.0f - ((voltage - TURB_V_DIRTY) / (TURB_V_CLEAR - TURB_V_DIRTY)));
    return constrain(ntu, 0.0f, TURB_NTU_MAX);
}

#if AJSR04M_ENABLED
float readWaterLevelCm() {
    digitalWrite(PIN_TRIG, LOW);
    delayMicroseconds(2);
    digitalWrite(PIN_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_TRIG, LOW);

    long duration = pulseIn(PIN_ECHO, HIGH, 50000); // timeout 50ms, cover 8m

    Serial.print("[AJ-SR04M] Duration us: ");
    Serial.println(duration);

    if (duration == 0) return -999.0f;

    float distanceCm = duration * 0.0343f / 2.0f;
    Serial.print("[AJ-SR04M] Distance cm: ");
    Serial.println(distanceCm);

    float level = SENSOR_HEIGHT_CM - distanceCm;
    return max(0.0f, level);
}
#endif

float estimateDO(float tempC) {
    if (tempC < 0) return -999.0f;
    return 14.62f - (0.3898f * tempC) + (0.006969f * tempC * tempC) - (0.00005896f * tempC * tempC * tempC);
}

#if AJSR04M_ENABLED
float calcDischarge(float levelCm) {
    if (levelCm <= 0) return 0.0f;
    float levelM = levelCm / 100.0f;
    return RATING_A * powf(levelM, RATING_B);
}
#endif

// ─── WiFi ──────────────────────────────────────────────────

void connectWiFi() {
    Serial.print("[WiFi] Connecting to ");
    Serial.println(WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
        digitalWrite(PIN_LED_POWER, HIGH);
    } else {
        Serial.println("\n[WiFi] FAILED — akan retry di loop");
    }
}

// ─── MQTT ──────────────────────────────────────────────────

void connectMQTT() {
    Serial.print("[MQTT] Connecting...");
    if (mqtt.connect(DEVICE_ID, MQTT_USER, MQTT_PASS)) {
        Serial.println(" OK");
    } else {
        Serial.print(" FAILED rc=");
        Serial.println(mqtt.state());
    }
}

// ─── Setup ─────────────────────────────────────────────────

void setup() {
    Serial.begin(115200);
    delay(1000);

    pinMode(PIN_LED_POWER, OUTPUT);
    pinMode(PIN_LED_STATUS, OUTPUT);
#if AJSR04M_ENABLED
    pinMode(PIN_TRIG, OUTPUT);
    pinMode(PIN_ECHO, INPUT);
#endif
    analogReadResolution(12);

    digitalWrite(PIN_LED_POWER, HIGH);
    digitalWrite(PIN_LED_STATUS, HIGH);
    delay(500);
    digitalWrite(PIN_LED_STATUS, LOW);

    ds18b20.begin();
    Serial.print("[DS18B20] Boot device count: ");
    Serial.println(ds18b20.getDeviceCount());

    Serial.println("[INIT] Waiting for power rails to stabilize...");
    delay(2000);

    connectWiFi();
    mqtt.setServer(MQTT_HOST, MQTT_PORT);
    mqtt.setBufferSize(512);
    connectMQTT();

    Serial.println("[READY] Umbulan Water Monitor started");
}

// ─── Loop ──────────────────────────────────────────────────

void loop() {
    if (WiFi.status() != WL_CONNECTED) {
        digitalWrite(PIN_LED_POWER, LOW);
        delay(3000);
        connectWiFi();
    }

    if (!mqtt.connected()) {
        connectMQTT();
    }
    mqtt.loop();

    unsigned long now = millis();
    if (now - lastPublish >= PUBLISH_INTERVAL_MS) {
        lastPublish = now;

        float temp = readTemperature();
        float turb = readTurbidityNTU();
        float doEst = (temp > 0) ? estimateDO(temp) : -999.0f;
#if PH_SENSOR_CONNECTED
        float ph = readPH();
#endif
#if AJSR04M_ENABLED
        float level = readWaterLevelCm();
        float discharge = (level > 0) ? calcDischarge(level) : 0.0f;
#endif

        ledStatusState = !ledStatusState;
        digitalWrite(PIN_LED_STATUS, ledStatusState);

        JsonDocument doc;
        doc["device_id"] = DEVICE_ID;
        if (temp > -100) doc["temperature"]  = serialized(String(temp, 2));
#if PH_SENSOR_CONNECTED
        if (ph > 0 && ph < 14) doc["ph"]     = serialized(String(ph, 2));
#endif
        if (turb >= 0)   doc["turbidity"]    = serialized(String(turb, 1));
        if (doEst > 0)   doc["do_estimated"] = serialized(String(doEst, 2));
#if AJSR04M_ENABLED
        if (level >= 0)  doc["water_level_cm"] = serialized(String(level, 1));
        doc["discharge_m3s"] = serialized(String(discharge, 4));
#endif

        char payload[512];
        serializeJson(doc, payload);

        if (mqtt.publish(MQTT_TOPIC, payload)) {
            Serial.print("[MQTT] Published: ");
            Serial.println(payload);
        } else {
            Serial.println("[MQTT] Publish FAILED");
        }
    }
}
