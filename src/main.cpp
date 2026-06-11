#include <Arduino.h>

#define PH_PIN 4

// Kalibrasi: ukur voltage saat probe di buffer pH 7.0 dan pH 4.0
// Sementara pakai nilai default, update setelah kalibrasi
#define PH_VREF      3.3
#define ADC_BITS     4095.0
#define PH_NEUTRAL_V 1.65   // voltage saat pH 7 (default ~Vref/2)
#define PH_SLOPE     0.18   // volt per pH unit (update setelah kalibrasi)

float readPH() {
    int raw = analogRead(PH_PIN);
    float voltage = raw * (PH_VREF / ADC_BITS);
    float ph = 7.0 + ((PH_NEUTRAL_V - voltage) / PH_SLOPE);
    return ph;
}

void setup() {
    Serial.begin(115200);
    unsigned long t = millis();
    while (!Serial && (millis() - t) < 3000);

    Serial.println("pH-4502C Test — Umbulan Water Monitor");
    analogReadResolution(12);
}

void loop() {
    int raw = analogRead(PH_PIN);
    float voltage = raw * (PH_VREF / ADC_BITS);
    float ph = readPH();

    Serial.print("ADC raw: ");
    Serial.print(raw);
    Serial.print("  Voltage: ");
    Serial.print(voltage, 3);
    Serial.print(" V  pH: ");
    Serial.println(ph, 2);

    delay(1000);
}
