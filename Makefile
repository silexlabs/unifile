TESTS = test/test-cases/*.js
test:
	mocha --timeout 5000 $(TESTS)
.PHONY: test
