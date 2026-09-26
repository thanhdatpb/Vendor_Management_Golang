package authn

import (
	"encoding/json"
	"strings"
)

// User chứa đúng các cột cần cho xác thực/phân quyền. Các handler nghiệp vụ
// không được nhận password hay token hash.
type User struct {
	ID         int64
	Name       string
	FullName   *string
	Email      string
	Password   *string
	Role       string
	Project    *string
	PDProjects json.RawMessage
	SellerName *string
	AvatarURL  *string
	IsActive   bool
}

func (u User) NormalizedRole() string {
	r := strings.ToLower(u.Role)
	r = strings.NewReplacer("_", "", "-", "", " ", "").Replace(r)
	return r
}

func (u User) IsAdmin() bool { return u.NormalizedRole() == "admin" }

func (u User) HasRole(allowed ...string) bool {
	role := u.NormalizedRole()
	for _, candidate := range allowed {
		candidate = strings.ToLower(candidate)
		candidate = strings.NewReplacer("_", "", "-", "", " ", "").Replace(candidate)
		if role == candidate {
			return true
		}
	}
	return false
}

type AccountSummary struct {
	ID       int64   `json:"id"`
	Role     string  `json:"role"`
	Project  *string `json:"project"`
	FullName string  `json:"full_name"`
}

func (u User) Summary() AccountSummary {
	name := u.Name
	if u.FullName != nil && *u.FullName != "" {
		name = *u.FullName
	}
	return AccountSummary{ID: u.ID, Role: u.Role, Project: u.Project, FullName: name}
}

type UserPayload struct {
	ID         int64    `json:"id"`
	Name       string   `json:"name"`
	FullName   *string  `json:"full_name"`
	Email      string   `json:"email"`
	Role       string   `json:"role"`
	Project    *string  `json:"project"`
	Projects   []string `json:"projects"`
	PDProjects []string `json:"pd_projects"`
	SellerName *string  `json:"seller_name"`
	AvatarURL  *string  `json:"avatar_url"`
}

func (u User) Payload(projects []string) UserPayload {
	pdProjects := []string{}
	if len(u.PDProjects) > 0 && string(u.PDProjects) != "null" {
		_ = json.Unmarshal(u.PDProjects, &pdProjects)
	}
	if projects == nil {
		projects = []string{}
	}
	return UserPayload{
		ID: u.ID, Name: u.Name, FullName: u.FullName, Email: u.Email,
		Role: u.Role, Project: u.Project, Projects: projects,
		PDProjects: pdProjects, SellerName: u.SellerName, AvatarURL: u.AvatarURL,
	}
}
