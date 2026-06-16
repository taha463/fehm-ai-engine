import httpx
# Replace with your token
headers = {"Authorization": "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"}
data = {
    "messages": [{"role": "user", "content": "Say hello"}],
    "model": "gpt-4o-mini"
}
try:
    print("Testing connection directly...")
    r = httpx.post("https://models.inference.ai.azure.com/chat/completions", 
                   json=data, headers=headers, timeout=10.0, verify=False)
    print("Response:", r.json())
except Exception as e:
    print("Connection failed at the network level:", e)