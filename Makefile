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

# toute la batterie, dans l'ordre du plus rapide au plus lent.
# les tests e2e ont besoin de postgres et redis : "make docker-up" avant.
# c'est la meme cible que celle lancee par la CI (.github/workflows/ci.yml).
check: check-back check-mobile

check-back:
	@echo "--- backend : types ---"
	cd backend && npx tsc --noEmit
	@echo "--- backend : build ---"
	cd backend && npm run build
	@echo "--- backend : tests unitaires ---"
	cd backend && npx jest --ci
	@echo "--- backend : tests e2e ---"
	cd backend && npx jest --config ./test/jest-e2e.json --ci --forceExit

check-mobile:
	@echo "--- mobile : types ---"
	cd mobile && npx tsc --noEmit

API_URL ?= http://localhost:3000

seed-users:
	API_URL=$(API_URL) node scripts/seed-users.js
	@# comptes de demo sans vraie boite mail : on les valide en base, sinon
	@# l'app les bloque sur l'ecran de verification
	docker compose exec -T postgres psql -U postgres -d musicroom -c \
		"UPDATE \"user\" SET \"emailisVerified\" = true WHERE email LIKE 'seed.%@musicroom.local';"

# --- Test de charge (sujet V.7) --- voir docs/ramp-up.md
PEAK_VUS ?= 200
STAGE ?= 1m
LOAD_USERS ?= 20
LOAD_STEPS ?= 10,25,50,100,200
LOAD_DURATION ?= 20

load-seed:
	node scripts/load/seed-load-users.js --users $(LOAD_USERS) --api $(API_URL)

# runner en node pur, aucune dependance a installer
load-test:
	@test -f scripts/load/load-users.json || { echo "Pool absent : lance d'abord 'make load-seed'"; exit 1; }
	node scripts/load/run-load-test.js --api $(API_URL) --steps $(LOAD_STEPS) --duration $(LOAD_DURATION)

# variante k6, pour qui l'a installe (montee progressive + scenario d'ecriture)
load-test-k6:
	@command -v k6 >/dev/null || { echo "k6 absent : voir l'installation dans docs/ramp-up.md"; exit 1; }
	@test -f scripts/load/load-users.json || { echo "Pool absent : lance d'abord 'make load-seed'"; exit 1; }
	API_URL=$(API_URL) PEAK_VUS=$(PEAK_VUS) STAGE=$(STAGE) k6 run scripts/load/k6-ramp-up.js

# Preuve anti-bruteforce (V.6) : a lancer THROTTLE_ALLOWLIST vide, cf. docs/ramp-up.md
load-throttle-check:
	@command -v k6 >/dev/null || { echo "k6 absent : voir l'installation dans docs/ramp-up.md"; exit 1; }
	API_URL=$(API_URL) CHECK_THROTTLE=1 k6 run scripts/load/k6-ramp-up.js
