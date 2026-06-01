install:
	cd backend && npm install
	cd mobile && npm install

dev-back:
	cd backend && npm run start:dev

dev-mobile:
	cd mobile && npx expo start

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

test:
	cd backend && npm run test
