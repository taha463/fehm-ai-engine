import httpx
# Replace with your token
headers = {"Authorization": "Github-token"}
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
