package libraryapi

import "vendorhub/internal/httpx"

func etag(scope, stampValue string, parts ...string) string {
	return httpx.LibraryETag(scope, stampValue, parts...)
}
