package media

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"mime"
	"mime/multipart"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type Config struct {
	Disk, Root           string
	AccessKey, SecretKey string
	Region, Bucket       string
	PublicURL, Endpoint  string
	UsePathStyle         bool
}

func New(ctx context.Context, config Config) (Storage, error) {
	if config.Disk == "" || config.Disk == "public" || config.Disk == "local" {
		return Local{Root: config.Root}, nil
	}
	if config.Bucket == "" || config.AccessKey == "" || config.SecretKey == "" {
		return nil, errors.New("thiếu AWS_BUCKET/AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY")
	}
	region := config.Region
	if region == "" {
		region = "auto"
	}
	loaded, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(region),
		awsconfig.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(config.AccessKey, config.SecretKey, "")),
	)
	if err != nil {
		return nil, err
	}
	client := s3.NewFromConfig(loaded, func(options *s3.Options) {
		if config.Endpoint != "" {
			options.BaseEndpoint = aws.String(strings.TrimRight(config.Endpoint, "/"))
		}
		options.UsePathStyle = config.UsePathStyle
	})
	return &S3{client: client, bucket: config.Bucket, publicURL: strings.TrimRight(config.PublicURL, "/")}, nil
}

type S3 struct {
	client    *s3.Client
	bucket    string
	publicURL string
}

func (s *S3) Save(ctx context.Context, file *multipart.FileHeader, folder string, maxBytes int64, videos bool) (string, string, error) {
	if file == nil || file.Size <= 0 || file.Size > maxBytes {
		return "", "", errors.New("kích thước media không hợp lệ")
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !validExtension(ext, videos) {
		return "", "", errors.New("định dạng media không được hỗ trợ")
	}
	body, err := file.Open()
	if err != nil {
		return "", "", err
	}
	defer body.Close()
	return s.put(ctx, body, file.Size, folder, ext)
}

func (s *S3) SavePath(ctx context.Context, sourcePath, folder string, maxBytes int64, videos bool) (string, string, error) {
	info, err := os.Stat(sourcePath)
	if err != nil || info.Size() <= 0 || info.Size() > maxBytes {
		return "", "", errors.New("kích thước media không hợp lệ")
	}
	ext := strings.ToLower(filepath.Ext(sourcePath))
	if !validExtension(ext, videos) {
		return "", "", errors.New("định dạng media không được hỗ trợ")
	}
	body, err := os.Open(sourcePath)
	if err != nil {
		return "", "", err
	}
	defer body.Close()
	return s.put(ctx, body, info.Size(), folder, ext)
}

func (s *S3) put(ctx context.Context, body io.Reader, size int64, folder, ext string) (string, string, error) {
	name, err := randomFilename(ext)
	if err != nil {
		return "", "", err
	}
	key := folder + "/" + name
	contentType := mime.TypeByExtension(ext)
	_, err = s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(s.bucket), Key: aws.String(key), Body: body,
		ContentLength: aws.Int64(size), ContentType: aws.String(contentType),
	})
	if err != nil {
		return "", "", err
	}
	return key, s.url(key), nil
}

func (s *S3) DeleteURL(ctx context.Context, raw string) error {
	key := Key(raw)
	if key == "" {
		return nil
	}
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(key)})
	return err
}

func (s *S3) Read(ctx context.Context, folder, filename string) (Object, error) {
	if filepath.Base(filename) != filename || filename == "." || filename == "" {
		return Object{}, os.ErrNotExist
	}
	output, err := s.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(s.bucket), Key: aws.String(folder + "/" + filename)})
	if err != nil {
		return Object{}, err
	}
	modified := aws.ToTime(output.LastModified)
	return Object{Body: output.Body, ContentType: aws.ToString(output.ContentType), Size: aws.ToInt64(output.ContentLength), Modified: modified}, nil
}

func (s *S3) url(key string) string {
	if s.publicURL == "" {
		return key
	}
	parts := strings.Split(key, "/")
	for index := range parts {
		parts[index] = url.PathEscape(parts[index])
	}
	return s.publicURL + "/" + strings.Join(parts, "/")
}

func validExtension(ext string, videos bool) bool {
	return imageExtensions[ext] || (videos && videoExtensions[ext])
}

func randomFilename(ext string) (string, error) {
	var random [16]byte
	if _, err := rand.Read(random[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(random[:]) + ext, nil
}
