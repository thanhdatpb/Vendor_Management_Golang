package config

import (
	"encoding/base64"
	"testing"
)

func TestDecodeLaravelKey(t *testing.T) {
	want := []byte("01234567890123456789012345678901")
	got, err := decodeLaravelKey("base64:" + base64.StdEncoding.EncodeToString(want))
	if err != nil || string(got) != string(want) {
		t.Fatalf("decodeLaravelKey() = %q, %v", got, err)
	}
}

func TestProductionRequiresAppKey(t *testing.T) {
	c := Config{Environment: "production", HTTPAddr: ":8001", DBHost: "db", DBName: "app", DBUser: "app"}
	if err := c.Validate(); err == nil {
		t.Fatal("production không có APP_KEY phải bị từ chối")
	}
}
