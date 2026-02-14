## Bug Report: API Key Not Recognized

### Description
User reported that K.I.T. does not recognize their API key.

### User Feedback
> "So halb aber der erkennt mein apikey nicht an" (API key not recognized)

### Steps to Reproduce
1. Install K.I.T.
2. Run onboarding or set API key
3. API key not accepted

### Expected Behavior
API key should be validated and stored correctly.

### Possible Causes
- Format validation too strict
- Provider detection issue
- Config file permissions
- Environment variable not read

### To Investigate
- [ ] Check API key validation logic in \src/cli/onboard-interactive.ts\
- [ ] Test with different providers (OpenAI, Anthropic)
- [ ] Check \kit doctor\ output
- [ ] Review config storage in \~/.kit/kit.json\

### Priority
High - Blocks user onboarding
