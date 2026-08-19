env:
	@./scripts/setup-env.sh

install: env
	cd backend && npm install
	cd mobile && npm install

start:
	docker compose up -d
	@echo "⏳ Attente que Postgres soit prêt..."
	@sleep 3
	cd backend && npm run start:all

stop:
	docker compose down
	@pkill -f "expo start" 2>/dev/null || true
	@pkill -f "nest start" 2>/dev/null || true

re: stop start

dev-back:
	cd backend && npm run start:dev

dev-mobile:
	cd mobile && npx expo start

dev-web:
	cd mobile && npx expo start --web

docker-up:
	docker compose up -d

docker-down:
	docker compose down

test:
	cd backend && npm run test

seed-users:
	API_URL=$(API_URL) node scripts/seed-users.js
