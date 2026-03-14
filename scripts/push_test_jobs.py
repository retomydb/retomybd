#!/usr/bin/env python3
"""Push 20 test jobs to Redis for validation."""
import redis, json

r = redis.from_url('redis://localhost:6379/0')
qlen = r.llen('github_repos')
print(f'Current queue length: {qlen}')

if qlen < 20:
    samples = [
        'ajiayi-debug/StockPPOLLMresearch', 'ahmed-ehabb/Llama_therapist',
        'huchunlinnk/minimind-details', 'R1M1N/finetune-qwen-2-5-vl',
        'swardiantara/LogNexus', 'Sampath-04/hinglish-translate-api',
        'ayjays132/NeuroReasoner-PlanningHead-1', 'opendatahub-io/modelcar-base-image',
        'hth810/try', 'jamessyjay/ml-train-k8s',
        'Piyush-1723/COMPASS-GDPR-Auditor', 'zaney955/minimind-annotated',
        'HMZ76/minimind', 'Saganaki22/ComfyUI-Maya1_TTS',
        'mouresh/vuln_detector_project', 'beniamine3155/Build_Custom_LLM_from_Scratch',
        'Asma-zubair/MeetSum', 'V1lch1s/NLP-HateSpeech',
        'NeuroSenko/ComfyUI_LLM_SDXL_Adapter', 'LidaChk/sigma108',
    ]
    pipe = r.pipeline()
    for s in samples:
        owner, repo = s.split('/')
        pipe.rpush('github_repos', json.dumps({
            'full_name': s, 'owner': owner, 'repo': repo,
            'repo_id': None, 'source': 'test', 'stars': 0,
            'language': None, 'description': '', 'topics': [], 'license': None,
        }))
    pipe.execute()
    print(f'Pushed {len(samples)} test jobs; new length: {r.llen("github_repos")}')
else:
    print(f'Queue already has {qlen} jobs, skipping push')
