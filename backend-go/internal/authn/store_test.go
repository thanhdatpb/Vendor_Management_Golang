package authn

import (
	"strings"
	"testing"
)

func TestRandomAlphaNumeric(t *testing.T) {
	got, err := randomAlphaNumeric(1000)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1000 {
		t.Fatalf("len = %d", len(got))
	}
	const allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	for _, r := range got {
		if !strings.ContainsRune(allowed, r) {
			t.Fatalf("ký tự lạ %q", r)
		}
	}
}

func TestRoleNormalization(t *testing.T) {
	u := User{Role: "Staff_B"}
	if !u.HasRole("staff b", "vendor") {
		t.Fatal("Staff_B phải khớp staff b")
	}
	if u.IsAdmin() {
		t.Fatal("Staff_B không phải admin")
	}
}
