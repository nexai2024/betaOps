# Google Gemini Setup for BetaOps

BetaOps uses **Google Gemini** as the default AI provider for test generation, failure analysis, and insights. This guide shows you how to get started.

---

## Why Gemini?

- **Free Tier**: 60 requests per minute at no cost
- **High Quality**: Gemini 1.5 Pro matches or exceeds GPT-4 performance
- **Fast**: Low latency, especially with Gemini 1.5 Flash
- **Multimodal**: Support for images, video (future features)
- **Safety**: Built-in safety filters and content moderation

---

## Getting Your API Key

### Step 1: Visit Google AI Studio

Go to **[Google AI Studio](https://makersuite.google.com/app/apikey)**

### Step 2: Sign In

Use your Google account to sign in.

### Step 3: Create API Key

1. Click **"Get API key"**
2. Click **"Create API key in new project"** (or select existing project)
3. Copy the API key (starts with `AIza...`)

### Step 4: Configure BetaOps

Add the API key to your `.env` file:

```bash
AI_PROVIDER="gemini"
AI_API_KEY="AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
AI_DEFAULT_MODEL="gemini-1.5-pro"
```

That's it! 🎉

---

## Available Models

### gemini-1.5-pro (Recommended)
- **Best for**: Complex test generation, detailed analysis
- **Context window**: 2M tokens (massive!)
- **Rate limit**: 2 RPM (free), 1000 RPM (paid)
- **Speed**: Moderate
- **Quality**: Highest

### gemini-1.5-flash (Fast & Cheap)
- **Best for**: Quick test suggestions, bulk generation
- **Context window**: 1M tokens
- **Rate limit**: 15 RPM (free), 1000 RPM (paid)
- **Speed**: Very fast
- **Quality**: Good

### gemini-1.0-pro (Legacy)
- **Best for**: Simple tasks, compatibility
- **Context window**: 32K tokens
- **Rate limit**: 60 RPM (free)
- **Speed**: Fast
- **Quality**: Good

---

## Configuration Examples

### Default Setup (Recommended)

```bash
AI_PROVIDER="gemini"
AI_API_KEY="your-key-here"
AI_DEFAULT_MODEL="gemini-1.5-pro"
```

### Speed-Optimized (Use Flash)

```bash
AI_PROVIDER="gemini"
AI_API_KEY="your-key-here"
AI_DEFAULT_MODEL="gemini-1.5-flash"
```

### Custom Endpoint (Enterprise)

```bash
AI_PROVIDER="gemini"
AI_API_KEY="your-key-here"
AI_BASE_URL="https://your-proxy.com/v1beta"
AI_DEFAULT_MODEL="gemini-1.5-pro"
```

---

## Rate Limits & Pricing

### Free Tier (Generous!)

| Model | Free RPM | Free RPD | Cost |
|-------|----------|----------|------|
| Gemini 1.5 Pro | 2 | 50 | $0 |
| Gemini 1.5 Flash | 15 | 1500 | $0 |
| Gemini 1.0 Pro | 60 | N/A | $0 |

**RPM** = Requests per minute  
**RPD** = Requests per day

### Paid Tier (Pay-as-you-go)

| Model | Price (Input) | Price (Output) | Paid RPM |
|-------|---------------|----------------|----------|
| Gemini 1.5 Pro | $3.50 / 1M tokens | $10.50 / 1M tokens | 1000 |
| Gemini 1.5 Flash | $0.075 / 1M tokens | $0.30 / 1M tokens | 1000 |

**Estimated costs for BetaOps**:
- User story generation: ~$0.01 per story
- Test case generation: ~$0.02 per test case
- Failure analysis: ~$0.015 per analysis
- Weekly summary: ~$0.03 per report

Most users stay well within the **free tier**.

---

## Safety & Content Filtering

Gemini includes built-in safety filters for:
- Harassment
- Hate speech
- Sexually explicit content
- Dangerous content

BetaOps configures these to **BLOCK_MEDIUM_AND_ABOVE** by default.

### Handling Blocked Responses

If a response is blocked:
```
Error: Response blocked by Gemini safety filters
```

Solutions:
1. Rephrase your input to be more neutral
2. Adjust safety settings (not recommended)
3. Use a different AI provider for that request

---

## Switching to Other Providers

### OpenAI

```bash
AI_PROVIDER="openai"
AI_API_KEY="sk-your-openai-key"
AI_DEFAULT_MODEL="gpt-4-turbo-preview"
```

### Anthropic Claude

```bash
AI_PROVIDER="anthropic"
AI_API_KEY="sk-ant-your-anthropic-key"
AI_DEFAULT_MODEL="claude-3-sonnet-20240229"
```

### Local Models (Ollama)

```bash
AI_PROVIDER="local"
AI_BASE_URL="http://localhost:11434"
AI_DEFAULT_MODEL="llama2"
```

---

## Testing Your Setup

### 1. Start BetaOps

```bash
npm run dev
```

### 2. Generate Test Cases

1. Sign in to BetaOps
2. Navigate to a project
3. Click **"Generate with AI"**
4. Select **"Test Cases"**
5. Click **"Generate"**

### 3. Check Logs

You should see in the terminal:
```
AI Generation Log: {
  provider: "gemini",
  model: "gemini-1.5-pro",
  task: "generate_test_cases",
  status: "success"
}
```

---

## Troubleshooting

### Error: "Invalid API key"

**Solution**: Check that your API key is correct and active.

```bash
# Test your API key
curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY"
```

### Error: "Quota exceeded"

**Solution**: You've hit the free tier rate limit.

Options:
1. Wait for the rate limit to reset (1 minute)
2. Upgrade to paid tier
3. Switch to Gemini Flash (higher free limit)
4. Use OpenAI or Anthropic temporarily

### Error: "Model not found"

**Solution**: Check that the model name is correct:
- ✅ `gemini-1.5-pro`
- ✅ `gemini-1.5-flash`
- ❌ `gemini-pro` (old name)

### Error: "Safety filter blocked"

**Solution**: Your input triggered safety filters.

Check for:
- Sensitive content in test case descriptions
- Potentially harmful code examples
- Personal information (PII)

Rephrase to be more neutral and professional.

---

## Performance Tips

### 1. Use Flash for Bulk Operations

When generating many test cases at once:
```bash
AI_DEFAULT_MODEL="gemini-1.5-flash"  # 5x faster, 50x cheaper
```

### 2. Optimize Token Usage

Gemini 1.5 Pro has a 2M token context window, but shorter prompts = faster responses:
- Keep project descriptions concise
- Limit code diffs to relevant changes
- Use summaries instead of full logs

### 3. Batch Requests

Instead of generating test cases one-by-one, generate 5-10 at once:
```
Generate 10 test cases for this user story...
```

### 4. Cache System Prompts

BetaOps automatically caches the system prompt, reducing costs and latency.

---

## Migration from OpenAI

If you were using OpenAI:

### 1. Get Gemini API Key

See [Getting Your API Key](#getting-your-api-key) above.

### 2. Update .env

```diff
- AI_PROVIDER="openai"
- AI_API_KEY="sk-your-openai-key"
- AI_DEFAULT_MODEL="gpt-4-turbo-preview"
+ AI_PROVIDER="gemini"
+ AI_API_KEY="AIza-your-gemini-key"
+ AI_DEFAULT_MODEL="gemini-1.5-pro"
```

### 3. Restart BetaOps

```bash
npm run dev
```

### 4. Test

Generate a test case to verify it works.

**Quality Comparison**:
- Gemini 1.5 Pro ≈ GPT-4 Turbo
- Gemini 1.5 Flash ≈ GPT-3.5 Turbo (but faster)

---

## FAQ

**Q: Is Gemini free forever?**  
A: The free tier is generous and designed for developers. Google has not announced plans to remove it.

**Q: Can I use Gemini in production?**  
A: Yes! Many companies use Gemini in production. For high-scale, consider the paid tier.

**Q: Does Gemini have streaming?**  
A: Yes, BetaOps will add streaming support in a future update.

**Q: Is my data used for training?**  
A: No, according to [Google's policy](https://ai.google.dev/terms), data sent via API is not used to train public models.

**Q: Can I use multiple providers?**  
A: Not simultaneously, but you can switch between providers by changing `AI_PROVIDER` in `.env`.

**Q: What about Google Vertex AI?**  
A: Vertex AI is for enterprise. BetaOps uses the simpler Google AI API. Vertex support may be added later.

---

## Resources

- **Official Docs**: https://ai.google.dev/docs
- **API Reference**: https://ai.google.dev/api/rest/v1beta/models
- **Pricing**: https://ai.google.dev/pricing
- **Model Comparison**: https://ai.google.dev/models/gemini
- **Get API Key**: https://makersuite.google.com/app/apikey

---

**Last Updated**: 2025-10-30  
**BetaOps Version**: 1.0.0
