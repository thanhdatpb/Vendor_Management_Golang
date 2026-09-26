# Ảnh runtime của backend-go.
#
# Vì sao ảnh cuối là node chứ không phải scratch/alpine trần: chức năng import
# vendor vẫn gọi scripts/extract_excel.cjs qua subprocess để đọc ảnh NHÚNG
# TRONG Ô Excel. Đây là phần khó nhất của cả hệ thống và đã chạy production ổn
# định, nên bản port Go cố ý giữ nguyên script thay vì viết lại bằng excelize.
# Bỏ được script thì đổi ảnh cuối sang alpine và xoá stage scripts.

# ── Stage 1: biên dịch binary Go ──────────────────────────────────────────
FROM golang:1.26-alpine AS build

WORKDIR /src

# Tải dependency trước, tách khỏi mã nguồn để lớp cache không vỡ mỗi lần sửa code.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# CGO_ENABLED=0 cho binary tĩnh; -trimpath bỏ đường dẫn máy build khỏi binary.
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/vendorhub ./cmd/server

# ── Stage 2: dependency Node cho script trích xuất Excel ──────────────────
FROM node:22-alpine AS scripts

WORKDIR /scripts

# npm ci đọc package-lock.json nên bản cài lại đúng phiên bản đã khoá.
COPY scripts/package.json scripts/package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 3: ảnh chạy thật ────────────────────────────────────────────────
FROM node:22-alpine

# Chạy bằng user thường, không phải root.
RUN adduser -D -u 10001 app

WORKDIR /app

COPY --from=build   /out/vendorhub        /app/vendorhub
COPY --from=scripts /scripts/node_modules /app/scripts/node_modules
COPY scripts/extract_excel.cjs            /app/scripts/extract_excel.cjs

# Thư mục media do tiến trình Go sở hữu; gắn volume vào đây để ảnh upload sống
# qua các lần deploy.
RUN mkdir -p /app/storage/media && chown -R app:app /app/storage

USER app

EXPOSE 8001

# Healthcheck dùng chính endpoint /health/ready của ứng dụng — nó kiểm cả kết
# nối DB, nên container chỉ được coi là khỏe khi thực sự phục vụ được request.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8001/health/ready >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/app/vendorhub"]
