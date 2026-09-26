package authn

import (
	"bytes"
	"testing"
)

func TestLaravelCipherRoundTrip(t *testing.T) {
	c, err := NewLaravelCipher([]byte("01234567890123456789012345678901"))
	if err != nil {
		t.Fatal(err)
	}
	want := []byte(`{"email":"seller@example.com","exp":1780000000}`)
	token, err := c.EncryptString(want)
	if err != nil {
		t.Fatal(err)
	}
	got, err := c.DecryptString(token)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, want) {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestLaravelCipherRejectsTamper(t *testing.T) {
	c, _ := NewLaravelCipher([]byte("01234567890123456789012345678901"))
	token, _ := c.EncryptString([]byte("secret"))
	tampered := token[:len(token)-2] + "AA"
	if _, err := c.DecryptString(tampered); err == nil {
		t.Fatal("payload bị sửa phải bị từ chối")
	}
}
