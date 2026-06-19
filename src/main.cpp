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

#define PUBLISH_INTERVAL_MS  10000   // kirim data setiap 10 detik

// ─── Pin ───────────────────────────────────────────────────
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

// pH-4502C: update nilai ini setelah kalibrasi dengan buffer pH 4 & 7
#define PH_NEUTRAL_V    1.65f
#define PH_SLOPE        0.18f

// Turbiditas: tegangan saat jernih dan keruh (update setelah kalibrasi)
#define TURB_V_CLEAR    4.2f
#define TURB_V_DIRTY    1.0f
#define TURB_NTU_MAX    3000.0f

// AJ-SR04M: tinggi sensor dari dasar saluran (cm) — ukur saat setup lapangan
#define SENSOR_HEIGHT_CM  100.0f

// Stage-discharge rating curve: Q = a * H^b
// Update koefisien ini setelah pengukuran dengan current meter
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

float readPH() {
    // Rata-rata 10 sampel untuk stabilisasi
    long sum = 0;
    for (int i = 0; i < 10; i++) {
        sum += analogRead(PIN_PH);
        delay(10);
    }
    float voltage = (sum / 10.0f) * (ADC_VREF / ADC_MAX);
    return 7.0f + ((PH_NEUTRAL_V - voltage) / PH_SLOPE);
}

float readTurbidityNTU() {
    long sum = 0;
    for (int i = 0; i < 10; i++) {
        sum += analogRead(PIN_TURBIDITY);
        delay(10);
    }
    float voltage = (sum / 10.0f) * (ADC_VREF / ADC_MAX);
    // Interpolasi linear: tegangan tinggi = jernih, tegangan rendah = keruh
    float ntu = TURB_NTU_MAX * (1.0f - ((voltage - TURB_V_DIRTY) / (TURB_V_CLEAR - TURB_V_DIRTY)));
    return constrain(ntu, 0.0f, TURB_NTU_MAX);
}

float readWaterLevelCm() {
    // Trigger pulse
    digitalWrite(PIN_TRIG, LOW);
    delayMicroseconds(2);
    digitalWrite(PIN_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_TRIG, LOW);

    long duration = pulseIn(PIN_ECHO, HIGH, 30000); // timeout 30ms
    if (duration == 0) return -999.0f;

    float distanceCm = duration * 0.0343f / 2.0f;
    float level = SENSOR_HEIGHT_CM - distanceCm;
    return max(0.0f, level);
}

float estimateDO(float tempC) {
    // Estimasi DO saturasi dari suhu (Benson & Krause, 1980)
    if (tempC < 0) return -999.0f;
    return 14.62f - (0.3898f * tempC) + (0.006969f * tempC * tempC) - (0.00005896f * tempC * tempC * tempC);
}

float calcDischarge(float levelCm) {
    if (levelCm <= 0) return 0.0f;
    float levelM = levelCm / 100.0f;
    return RATING_A * powf(levelM, RATING_B);
}

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
    pinMode(PIN_TRIG, OUTPUT);
    pinMode(PIN_ECHO, INPUT);
    analogReadResolution(12);

    // Test LED
    digitalWrite(PIN_LED_POWER, HIGH);
    digitalWrite(PIN_LED_STATUS, HIGH);
    delay(500);
    digitalWrite(PIN_LED_STATUS, LOW);

    ds18b20.begin();
    Serial.print("[DS18B20] Initialized, device count: ");
    Serial.println(ds18b20.getDeviceCount());

    connectWiFi();
    mqtt.setServer(MQTT_HOST, MQTT_PORT);
    mqtt.setBufferSize(512);
    connectMQTT();

    Serial.println("[READY] Umbulan Water Monitor started");
}

// ─── Loop ──────────────────────────────────────────────────

void loop() {
    // Jaga koneksi WiFi
    if (WiFi.status() != WL_CONNECTED) {
        digitalWrite(PIN_LED_POWER, LOW);
        connectWiFi();
    }

    // Jaga koneksi MQTT
    if (!mqtt.connected()) {
        connectMQTT();
    }
    mqtt.loop();

    unsigned long now = millis();
    if (now - lastPublish >= PUBLISH_INTERVAL_MS) {
        lastPublish = now;

        // Baca semua sensor
        float temp     = readTemperature();
        float ph       = readPH();
        float turb     = readTurbidityNTU();
        float level    = readWaterLevelCm();
        float doEst    = (temp > 0) ? estimateDO(temp) : -999.0f;
        float discharge = (level > 0) ? calcDischarge(level) : 0.0f;

        // Blink LED status saat publish
        ledStatusState = !ledStatusState;
        digitalWrite(PIN_LED_STATUS, ledStatusState);

        // Bangun JSON payload
        JsonDocument doc;
        doc["device_id"]      = DEVICE_ID;
        if (temp > -100)      doc["temperature"]    = serialized(String(temp, 2));
        if (ph > 0 && ph < 14) doc["ph"]            = serialized(String(ph, 2));
        if (turb >= 0)        doc["turbidity"]      = serialized(String(turb, 1));
        if (level >= 0)       doc["water_level_cm"] = serialized(String(level, 1));
        doc["discharge_m3s"]  = serialized(String(discharge, 4));
        if (doEst > 0)        doc["do_estimated"]   = serialized(String(doEst, 2));

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
