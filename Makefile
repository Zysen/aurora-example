.DEFAULT_GOAL := build

build-code: node_modules
	rm -rf output
	rm -rf generated
	mkdir output
	node aurora/build build.json

.PHONY: build
build: build-code test module-test

drop-db:
	export MYSQL_PWD=root
	echo 'drop database alphamanager; create database alphamanager' | mysql --port=3306 --host=127.0.0.1 --user=root

create-db:
	export MYSQL_PWD=root
	echo 'create database alphamanager' | mysql --port=3306 --host=127.0.0.1 --user=root


output/server.min.js: node_modules $(wildcard plugins/**/*.server.js)  $(wildcard plugins/**/*.shared.js) $(wildcard aurora/plugins/**/*.server.js) $(wildcard aurora/plugins/**/*.shared.js) $(wildcard plugins/recoil/**/*.js) $(wildcard plugins/closure-library/**/*.js) $(wildcard plugins/**/*.schema.json)
	node aurora/build build.json server

output/config.json: config.json
	cp config.json output/config.json

.PHONY: server
server: output/server.min.js output/config.json


resources: node_modules
	node aurora/build build.json resources
debug-server: node_modules
	node aurora/build build.json debug-server

client: node_modules
	node aurora/build build.json client

output/module-test.min.js: $(wildcard plugins/**/*.server.js)  $(wildcard plugins/**/*.shared.js) $(wildcard aurora/plugins/**/*.server.js) $(wildcard aurora/plugins/**/*.shared.js) $(wildcard plugins/recoil/**/*.js) $(wildcard plugins/closure-library/**/*.js) $(wildcard plugins/**/*.schema.json)
	node aurora/build build.json module-test

.PHONY: module-test
module-test: output/module-test.min.js output/server.min.js
#	node output/server.min.js --test 1> /dev/null 2>  /dev/null &
	node output/server.min.js --test 1> test.log 2>  /dev/null &
#       wait for node to start and create the database
	sh scripts/wait-for-test-start.sh

ifndef UNIT_TEST
	node_modules/.bin/jest --config=mjest.config.js 
else
	node_modules/.bin/jest --config=mjest.config.js -t '$(UNIT_TEST)'
endif





.PHONY: debug-client
debug-client:
	node aurora/build build.json debug-client

.PHONY: lint
lint:
	gjslint --disable 0100,0110,0120,0251,0012 `find plugins -name "*.js" -and -not -name "*_test.js" -and -not -path "plugins/closure-library/*" -not -name "*.min.js" -and -not -name "*.lib.js" -and -not -name build.js -and -not -type d -and -not -path "*/resources/htdocs/images/*.js" -and -not -path "*/resources/htdocs/scripts/*.js"`

.PHONY: lintfix
lintfix:
	fixjsstyle --disable 0100,0110,0120,0251,0012 `find plugins -name "*.js" -and -not -name "*_test.js" -and -not -path "plugins/closure-library/*" -not -name "*.min.js" -and -not -name "*.lib.js" -and -not -name build.js -and -not -type d -and -not -path "*/resources/htdocs/images/*.js" -and -not -path "*/resources/htdocs/scripts/*.js"`

.PHONY: test
test:
	node aurora/build build.json test-server	
ifndef UNIT_TEST
	node_modules/.bin/jest --testPathIgnorePatterns plugins/closure-library 
else
	node_modules/.bin/jest --testPathIgnorePatterns plugins/closure-library -t '$(UNIT_TEST)'
endif

.PHONY: rerun-test
rerun-test:
ifndef UNIT_TEST
	node_modules/.bin/jest --testPathIgnorePatterns plugins/closure-library 
else
	node_modules/.bin/jest --testPathIgnorePatterns plugins/closure-library -t '$(UNIT_TEST)'
endif


node_modules:
	npm install


.PHONY: install-modules
install-modules:
	npm install node-forge mime modern-syslog websocket async mysql moment nodemailer multiparty ics glob jest

ip-tables:
	sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8080
	sudo iptables -t nat -A PREROUTING -p tcp --dport 443 -j REDIRECT --to-port 8443

certbot-install:
	sudo snap install core; sudo snap refresh core
	sudo apt-get remove certbot
	sudo snap install --classic certbot
	sudo ln -s /snap/bin/certbot /usr/bin/certbot

certbot:
	certbot certonly --webroot --config-dir letsencrypt/config --work-dir letsencrypt/work --logs-dir letsencrypt/log --webroot-path output/resources/htdocs --cert-path letsencrypt/certs --cert-path letsencrypt/certs/cert.pem --key-path letsencrypt/certs/priv.pem

certbot-renew:
	certbot renew --webroot --config-dir letsencrypt/config --work-dir letsencrypt/work --logs-dir letsencrypt/log --webroot-path output/resources/htdocs --cert-path letsencrypt/certs --cert-path letsencrypt/certs/cert.pem --key-path letsencrypt/certs/priv.pem
certbot-remove:
	certbot delete --config-dir letsencrypt/config --work-dir letsencrypt/work --logs-dir letsencrypt/log

cert-backup-1:
	mkdir -p old-certs-1
	cp letsencrypt/config/live/*/privkey.pem letsencrypt/config/live/*/chain.pem letsencrypt/config/live/*/cert.pem old-certs-1

cert-backup-2:
	mkdir -p old-certs-2
	cp letsencrypt/config/live/*/privkey.pem letsencrypt/config/live/*/chain.pem letsencrypt/config/live/*/cert.pem old-certs-2


cert-restore-1:
	cp old-certs-1/privkey.pem letsencrypt/config/live/*/
	cp old-certs-1/cert.pem letsencrypt/config/live/*/
	cp old-certs-1/chain.pem letsencrypt/config/live/*/

cert-restore-2:
	cp old-certs-2/privkey.pem letsencrypt/config/live/*/
	cp old-certs-2/cert.pem letsencrypt/config/live/*/
	cp old-certs-2/chain.pem letsencrypt/config/live/*/
