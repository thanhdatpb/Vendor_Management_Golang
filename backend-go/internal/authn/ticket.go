package authn

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
)

// LaravelCipher tương thích Crypt::encryptString/decryptString với AES-256-CBC.
// Nhờ vậy vé chọn tài khoản phát trong lúc chạy song song dùng được ở cả PHP và Go.
type LaravelCipher struct{ key []byte }

func NewLaravelCipher(key []byte) (*LaravelCipher, error) {
	if len(key) != 32 {
		return nil, errors.New("LaravelCipher cần khóa 32 byte")
	}
	return &LaravelCipher{key: append([]byte(nil), key...)}, nil
}

type encryptedPayload struct {
	IV    string `json:"iv"`
	Value string `json:"value"`
	MAC   string `json:"mac"`
	Tag   string `json:"tag"`
}

func (c *LaravelCipher) EncryptString(plain []byte) (string, error) {
	block, err := aes.NewCipher(c.key)
	if err != nil {
		return "", err
	}
	iv := make([]byte, aes.BlockSize)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return "", err
	}
	padded := pkcs7Pad(plain, aes.BlockSize)
	ciphertext := make([]byte, len(padded))
	cipher.NewCBCEncrypter(block, iv).CryptBlocks(ciphertext, padded)
	iv64 := base64.StdEncoding.EncodeToString(iv)
	value64 := base64.StdEncoding.EncodeToString(ciphertext)
	mac := hmac.New(sha256.New, c.key)
	_, _ = mac.Write([]byte(iv64 + value64))
	payload := encryptedPayload{IV: iv64, Value: value64, MAC: hex.EncodeToString(mac.Sum(nil)), Tag: ""}
	raw, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(raw), nil
}

func (c *LaravelCipher) DecryptString(token string) ([]byte, error) {
	raw, err := base64.StdEncoding.DecodeString(token)
	if err != nil {
		return nil, errors.New("payload không hợp lệ")
	}
	var payload encryptedPayload
	if json.Unmarshal(raw, &payload) != nil || payload.IV == "" || payload.Value == "" || payload.MAC == "" {
		return nil, errors.New("payload không hợp lệ")
	}
	mac := hmac.New(sha256.New, c.key)
	_, _ = mac.Write([]byte(payload.IV + payload.Value))
	want, err := hex.DecodeString(payload.MAC)
	if err != nil || !hmac.Equal(mac.Sum(nil), want) {
		return nil, errors.New("MAC không hợp lệ")
	}
	iv, err := base64.StdEncoding.DecodeString(payload.IV)
	if err != nil || len(iv) != aes.BlockSize {
		return nil, errors.New("IV không hợp lệ")
	}
	ciphertext, err := base64.StdEncoding.DecodeString(payload.Value)
	if err != nil || len(ciphertext) == 0 || len(ciphertext)%aes.BlockSize != 0 {
		return nil, errors.New("ciphertext không hợp lệ")
	}
	block, _ := aes.NewCipher(c.key)
	plain := make([]byte, len(ciphertext))
	cipher.NewCBCDecrypter(block, iv).CryptBlocks(plain, ciphertext)
	return pkcs7Unpad(plain, aes.BlockSize)
}

func pkcs7Pad(in []byte, size int) []byte {
	n := size - len(in)%size
	return append(append([]byte(nil), in...), bytes.Repeat([]byte{byte(n)}, n)...)
}

func pkcs7Unpad(in []byte, size int) ([]byte, error) {
	if len(in) == 0 || len(in)%size != 0 {
		return nil, errors.New("padding không hợp lệ")
	}
	n := int(in[len(in)-1])
	if n < 1 || n > size || n > len(in) {
		return nil, errors.New("padding không hợp lệ")
	}
	for _, b := range in[len(in)-n:] {
		if int(b) != n {
			return nil, errors.New("padding không hợp lệ")
		}
	}
	return in[:len(in)-n], nil
}
