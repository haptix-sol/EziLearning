#!/usr/bin/env python3
"""Generate crates/varin-cli/data/education_presets.json with 250 Varin edu presets."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "crates" / "varin-cli" / "data" / "education_presets.json"

# Curated seeds: (base_template, title, extra_params_dict)
# Labels / counts must match each template's expectations in storyboard.rs

FLOW = [
    ("HTTP lifecycle", ["Client", "DNS", "TLS", "Server", "Response"]),
    ("Binary search", ["Sorted array", "Mid compare", "Halve range", "Found / not found"]),
    ("Git workflow", ["Edit", "Stage", "Commit", "Push", "PR review"]),
    ("CI/CD pipeline", ["Commit", "Build", "Test", "Deploy", "Monitor"]),
    ("OAuth2 outline", ["User", "Client", "Auth server", "Resource owner", "Token"]),
    ("REST design", ["Resource", "URI", "Verb", "Status", "Representation"]),
    ("Microservices path", ["API GW", "Service A", "Service B", "Message bus", "DB"]),
    ("Cache layers", ["Browser", "CDN", "App cache", "Redis", "Origin DB"]),
    ("ML inference", ["Features", "Model load", "Forward pass", "Post-process", "Output"]),
    ("ETL basics", ["Extract", "Validate", "Transform", "Load", "Audit"]),
    ("TCP handshake", ["SYN", "SYN-ACK", "ACK", "Data", "FIN"]),
    ("CAP reminder", ["Partition", "Choose C", "Choose A", "Choose P", "Tradeoff"]),
    ("K8s deploy", ["Manifest", "Scheduler", "Pod", "Service", "Ingress"]),
    ("SQL query path", ["Parser", "Planner", "Executor", "Storage", "Result"]),
    ("JWT flow", ["Login", "Sign", "Send token", "Verify", "Authorize"]),
    ("Rate limit", ["Request", "Counter", "Window", "Allow / deny", "Retry"]),
    ("B-tree lookup", ["Root", "Compare key", "Child", "Leaf", "Record"]),
    ("Dijkstra sketch", ["Start", "Relax edge", "PQ pop", "Visit", "Goal"]),
    ("MapReduce", ["Split", "Map", "Shuffle", "Reduce", "Output"]),
    ("Blockchain lite", ["Tx", "Block", "Hash chain", "Consensus", "Ledger"]),
    ("RAG pipeline", ["Query", "Embed", "Retrieve", "Augment", "Generate"]),
    ("Transformer block", ["Input", "Attention", "FFN", "Residual", "Norm"]),
    ("CNN stack", ["Conv", "ReLU", "Pool", "Flatten", "Dense"]),
    ("Backprop idea", ["Loss", "Grad", "Chain rule", "Update weights", "Step"]),
    ("Feature store", ["Raw events", "Engineering", "Online", "Offline", "Serve"]),
    ("A/B test", ["Hypothesis", "Split users", "Metrics", "Analyze", "Ship"]),
    ("Incident response", ["Detect", "Triage", "Mitigate", "Communicate", "Postmortem"]),
    ("Load balancer", ["Health", "Pick target", "Forward", "Session", "Scale"]),
    ("CQRS read", ["Command", "Write model", "Event", "Read model", "Query"]),
    ("Saga pattern", ["Step 1", "Step 2", "Compensate", "Complete", "Consistent"]),
    ("WebSocket", ["HTTP upgrade", "Handshake", "Frames", "Ping", "Close"]),
    ("GraphQL path", ["Schema", "Query", "Resolver", "Batch", "Response"]),
    ("gRPC call", ["Stub", "Channel", "HTTP/2", "Protobuf", "Server"]),
    ("SSE stream", ["Connect", "Headers", "Events", "Reconnect", "Close"]),
    ("Cron job", ["Schedule", "Trigger", "Worker", "Log", "Alert"]),
    ("Feature flag", ["Define", "Target", "Evaluate", "Rollout", "Kill switch"]),
    ("Idempotency", ["Request", "Key", "Store", "Replay safe", "Response"]),
    ("Pagination", ["Cursor", "Limit", "Next page", "Stable order", "Client"]),
    ("ACID recap", ["Atomic", "Consistent", "Isolated", "Durable", "Commit"]),
    ("Isolation levels", ["Read uncommitted", "Read committed", "Repeatable", "Serializable", "Pick"]),
    ("Index seek", ["Table", "Index", "Seek", "RID lookup", "Row"]),
    ("Hash join", ["Build", "Probe", "Buckets", "Match", "Output"]),
    ("Merge sort", ["Divide", "Left sort", "Right sort", "Merge", "Done"]),
    ("Quick sort pivot", ["Partition", "Left", "Right", "Recurse", "Base"]),
    ("Heap insert", ["Heapify up", "Parent check", "Swap", "Repeat", "Root"]),
    ("LRU cache", ["Get", "Hit?", "Evict tail", "Put head", "Update"]),
    ("Thread pool", ["Queue", "Worker", "Task", "Join", "Shutdown"]),
    ("Mutex pattern", ["Lock", "Critical section", "Unlock", "Deadlock avoid", "Order"]),
    ("Async await", ["Start", "Yield", "Poll", "Resume", "Complete"]),
    ("Virtual memory", ["VA", "TLB", "Page table", "Physical", "Fault"]),
    ("Process states", ["New", "Ready", "Running", "Blocked", "Terminated"]),
    ("Deadlock four", ["Hold", "Wait", "No preempt", "Circular", "Break"]),
    ("DFS vs BFS", ["Start", "Stack / queue", "Neighbor", "Mark", "Goal"]),
    ("Strong vs weak", ["Strong refs", "Cycle?", "Weak break", "GC", "Free"]),
    ("Compiler phases", ["Lex", "Parse", "Semantic", "IR", "Codegen"]),
    ("Regex NFA", ["Parse pattern", "Build graph", "Simulate", "Match", "Groups"]),
    ("DNS resolution", ["Stub", "Recursive", "Root", "TLD", "Authoritative"]),
    ("TLS record", ["Handshake", "Key derive", "Encrypt", "MAC", "Alert"]),
    ("SSH layers", ["Transport", "Auth", "Channel", "Forward", "Close"]),
    ("S3 object", ["Bucket", "Key", "PUT", "GET", "Version"]),
    ("Kafka publish", ["Producer", "Partition", "Broker", "Consumer group", "Offset"]),
    ("Spark stage", ["DAG", "Stage", "Shuffle", "Task", "Result"]),
    ("Snowflake store", ["Ingest", "Micro-partition", "Prune", "Scan", "Result"]),
    ("Vector DB", ["Embed", "Index", "ANN search", "Filter", "Top-k"]),
    ("Prompt chain", ["System", "User", "Tool call", "Observation", "Answer"]),
]

ORG = [
    ("Company org", ["CEO", "Eng", "Product", "Sales", "Ops"]),
    ("K8s cluster", ["Control plane", "etcd", "API server", "Scheduler", "Kubelet"]),
    ("Cloud account", ["Org", "Folder", "Project", "VPC", "Subnet"]),
    ("Data mesh", ["Domain A", "Domain B", "Catalog", "Lineage", "Access"]),
    ("Team topology", ["Stream", "Enabling", "Complicated", "Platform", "Fit"]),
    ("Clean arch", ["Entities", "Use cases", "Adapters", "Frameworks", "UI"]),
    ("Hexagonal", ["Domain", "Ports", "Primary adapter", "Secondary adapter", "Config"]),
    ("DDD context", ["Bounded context", "Ubiquitous language", "Aggregate", "Event", "Map"]),
    ("Onion model", ["Core", "Domain", "Application", "Infrastructure", "UI"]),
    ("Event-driven", ["Producer", "Topic", "Consumer", "Handler", "Store"]),
    ("Lambda layers", ["Runtime", "Lib", "Custom", "Permissions", "Trigger"]),
    ("VPC layout", ["IGW", "Public", "Private", "NAT", "Peering"]),
    ("IAM tree", ["Root", "OU", "Account", "Role", "Policy"]),
    ("Observability", ["Metrics", "Logs", "Traces", "Profiles", "SLO"]),
    ("Security layers", ["Perimeter", "Network", "Host", "App", "Data"]),
    ("CDN edge", ["User", "Edge PoP", "Shield", "Origin", "Cache"]),
    ("Mobile stack", ["UI", "Domain", "Data", "Network", "Analytics"]),
    ("Game loop", ["Input", "Update", "Physics", "Render", "Audio"]),
    ("Renderer pipe", ["App", "Geometry", "Raster", "Shade", "Present"]),
    ("DB replica set", ["Primary", "Secondary", "Arbiter", "Election", "Read pref"]),
    ("Sharding map", ["Router", "Shard 1", "Shard 2", "Shard 3", "Merge"]),
    ("Stream table", ["Source", "Watermark", "State", "Sink", "Exactly-once"]),
    ("Feature team", ["Discovery", "Build", "Release", "Learn", "Iterate"]),
    ("SRE model", ["Error budget", "Toil", "Automation", "Runbook", "Blameless"]),
    ("FinOps", ["Forecast", "Allocate", "Optimize", "Report", "Govern"]),
    ("API product", ["Spec", "Sandbox", "Version", "Deprecate", "SLA"]),
    ("Design system", ["Tokens", "Components", "Patterns", "Docs", "Adoption"]),
    ("Research loop", ["Question", "Method", "Data", "Analysis", "Insight"]),
    ("Product trio", ["PM", "Design", "Eng", "Outcome", "Metric"]),
    ("Sales funnel", ["Lead", "Qualify", "Demo", "Close", "Expand"]),
    ("Support tiers", ["L1", "L2", "L3", "Engineering", "RCA"]),
]

SWIM = [
    ("Order fulfillment", ["Receive", "Pick", "Pack", "Ship", "Notify"]),
    ("Hiring pipeline", ["Screen", "Interview", "Offer", "Onboard", "Probation"]),
    ("Code review", ["Open PR", "Review", "CI green", "Approve", "Merge"]),
    ("Release train", ["Plan", "Develop", "Stabilize", "Deploy", "Retro"]),
    ("Data approval", ["Request", "Legal", "Security", "Provision", "Audit"]),
    ("Bug triage", ["Report", "Reproduce", "Prioritize", "Fix", "Verify"]),
    ("Content publish", ["Draft", "Edit", "Legal", "Schedule", "Go live"]),
    ("Loan origination", ["Apply", "Credit", "Underwrite", "Docs", "Fund"]),
    ("Claims process", ["FNOL", "Investigate", "Reserve", "Pay", "Close"]),
    ("KYC flow", ["Capture", "Verify", "Risk", "Approve", "Monitor"]),
    ("Procurement", ["Req", "Approval", "PO", "Receive", "Invoice"]),
    ("Incident war room", ["Page", "Bridge", "Mitigate", "Comms", "Resolve"]),
    ("On-call shift", ["Handoff", "Watch", "Escalate", "Resolve", "Retro"]),
    ("Experiment", ["Design", "Launch", "Collect", "Analyze", "Decide"]),
    ("Backup restore", ["Snapshot", "Store", "Test restore", "RTO", "RPO"]),
    ("Pen test", ["Scope", "Recon", "Exploit", "Report", "Remediate"]),
    ("Vendor review", ["RFP", "Demo", "Security", "Contract", "Onboard"]),
    ("Migration wave", ["Assess", "Pilot", "Move", "Validate", "Cutover"]),
    ("DR drill", ["Declare", "Failover", "Verify", "Failback", "Report"]),
    ("Model governance", ["Register", "Bias check", "Approve", "Monitor", "Retire"]),
    ("Feature rollout", ["Internal", "Beta", "Canary", "Full", "Rollback"]),
    ("Cost review", ["Tag", "Allocate", "Anomaly", "Rightsize", "Commit"]),
    ("Accessibility", ["Audit", "Fix", "Retest", "Train", "Policy"]),
    ("Localization", ["Extract", "Translate", "Review", "Build", "QA"]),
    ("Docs update", ["Outline", "Write", "Review", "Publish", "Feedback"]),
    ("Customer success", ["Onboard", "Adopt", "Expand", "Renew", "Advocate"]),
    ("Partner API", ["Register", "Sandbox", "Certify", "Prod keys", "Monitor"]),
    ("Marketplace listing", ["SKU", "Pricing", "Compliance", "List", "Optimize"]),
    ("Video pipeline", ["Ingest", "Transcode", "Package", "CDN", "Play"]),
    ("Search relevance", ["Query", "Retrieve", "Rank", "Filter", "Learn"]),
    ("Fraud check", ["Signal", "Score", "Rule", "Review", "Action"]),
    ("Inventory sync", ["Source", "Transform", "Match", "Reconcile", "Alert"]),
    ("Payroll run", ["Time", "Calc", "Approve", "Pay", "Report"]),
    ("Tax filing", ["Collect", "Validate", "File", "Pay", "Archive"]),
    ("Patent filing", ["Disclosure", "Search", "Draft", "Prosecute", "Grant"]),
]

RECAP_TITLES = [
    "Key takeaways",
    "Summary board",
    "What to remember",
    "Core ideas",
    "Checklist",
    "Before you go",
    "Exam focus",
    "Interview angles",
    "Concept snapshot",
    "Quick recap",
    "Main points",
    "Study notes",
    "Essentials",
    "Big picture",
    "Deep dive wrap",
    "Practice targets",
    "Common pitfalls",
    "Definition pack",
    "Formula sheet",
    "Mnemonic hub",
    "Compare & contrast",
    "Timeline recap",
    "Vocabulary",
    "Must-know list",
    "Next steps",
    "Review frame",
    "Concept map",
    "Skill checklist",
    "Behavioral tips",
    "System design cues",
    "Coding patterns",
    "Complexity cheatsheet",
]

TIMELINE = [
    ("Product phases", ["Idea", "MVP", "PMF", "Scale", "Mature"]),
    ("Career ladder", ["Junior", "Mid", "Senior", "Staff", "Principal"]),
    ("Study week", ["Mon plan", "Tue deep", "Wed practice", "Thu review", "Fri mock"]),
    ("Sprint", ["Plan", "Build", "Test", "Demo", "Retro"]),
    ("Quarter goals", ["Q1", "Q2", "Q3", "Q4", "Review"]),
    ("CPU history", ["Vacuum", "Transistor", "IC", "Multi-core", "AI accel"]),
    ("Web eras", ["Static", "Dynamic", "AJAX", "SPA", "Edge"]),
    ("Java versions", ["8", "11", "17", "21", "Next LTS"]),
    ("Python wave", ["2.x", "3.0", "3.8", "3.11", "3.12+"]),
    ("Cloud gen", ["Colo", "IaaS", "PaaS", "SaaS", "Serverless"]),
    ("Agile spread", ["XP", "Scrum", "Kanban", "SAFe", "Shape up"]),
    ("Security SDLC", ["Design", "Code", "Test", "Release", "Ops"]),
    ("Data maturity", ["Ad-hoc", "Warehouse", "Lake", "Mesh", "AI-ready"]),
    ("MLOps stages", ["Notebook", "Pipeline", "Registry", "Serve", "Monitor"]),
    ("Zero trust steps", ["Identity", "Device", "Network", "App", "Data"]),
    ("IPv6 rollout", ["Dual stack", "Tunnel", "Native", "DNS64", "Sunset v4"]),
    ("TLS versions", ["1.0", "1.1", "1.2", "1.3", "Post-quantum prep"]),
    ("Storage media", ["Tape", "HDD", "SSD", "NVMe", "PMem"]),
    ("Display tech", ["CRT", "LCD", "LED", "OLED", "MicroLED"]),
    ("Battery tech", ["NiCd", "NiMH", "Li-ion", "Solid", "Future"]),
    ("Network speed", ["Dial-up", "DSL", "Fiber", "5G", "Satellite"]),
    ("Chip process", ["90nm", "45nm", "14nm", "5nm", "2nm"]),
    ("Open source era", ["GNU", "Linux boom", "GitHub", "Corp OSS", "Supply chain"]),
    ("DB eras", ["Hierarchical", "Relational", "NoSQL", "NewSQL", "Multi-model"]),
]

FORMULA_FLOW = [
    ("Loss landscape", ["Weights", "Forward", "Loss", "Backward", "Step"]),
    ("Gradient flow", ["Output", "Chain", "Hidden", "Input", "Update"]),
    ("Attention mix", ["Q", "K", "V", "Softmax", "Out"]),
    ("Bayes update", ["Prior", "Likelihood", "Evidence", "Posterior", "Decide"]),
    ("PageRank idea", ["Links", "Matrix", "Iterate", "Damping", "Rank"]),
    ("Gradient descent", ["Start", "Grad", "LR", "Step", "Converge"]),
    ("Newton step", ["f(x)", "f'(x)", "f''(x)", "Delta x", "Next"]),
    ("Kalman filter", ["Predict", "Covariance", "Update", "Gain", "Correct"]),
    ("FFT butterfly", ["Split", "Twiddle", "Combine", "Recursion", "O(n log n)"]),
    ("Entropy path", ["Distribution", "Log p", "Expectation", "H(X)", "Bits"]),
    ("Reliability block", ["MTBF", "MTTR", "Availability", "Redundancy", "SLO"]),
    ("Queueing view", ["Arrival", "Service", "Utilization", "Wait", "Stability"]),
    ("CAP pick", ["Latency", "Consistency", "Partition", "Choice", "Outcome"]),
    ("CAP trade", ["CP", "AP", "CA rare", "Pick two", "Document"]),
    ("Risk score", ["Threat", "Vuln", "Impact", "Likelihood", "Score"]),
    ("Amdahl law", ["Serial", "Parallel", "Speedup", "Limit", "Plan"]),
    ("Little law", ["L", "λ", "W", "Relation", "Capacity"]),
    ("Bloom filter", ["Hash k", "Bits", "Insert", "Query", "FP rate"]),
    ("Count-min sketch", ["Hash", "Buckets", "Min", "Estimate", "Error"]),
    ("Simulated annealing", ["Temp", "Neighbor", "Delta E", "Accept", "Cool"]),
]

MATH_PACK = [
    ("Quadratic roots", ["ax²+bx+c=0", "Discriminant", "Roots", "Vertex", "Plot"]),
    ("Pythagorean", ["a²", "b²", "c²", "Right Δ", "Distance"]),
    ("Log rules", ["log(ab)", "log(a/b)", "log(a^n)", "Change base", "Solve"]),
    ("Trig circle", ["sin", "cos", "tan", "Unit circle", "Radians"]),
    ("Matrix multiply", ["Rows", "Cols", "Dot", "Shape", "Result"]),
    ("Eigen sketch", ["Av=λv", "Characteristic", "Solve λ", "Eigenvector", "Diagonalize"]),
    ("Taylor idea", ["f(a)", "f'(a)", "f''(a)", "Remainder", "Approx"]),
    ("Integral view", ["Sum", "Limit", "Area", "FTC", "Apply"]),
    ("Complex plane", ["a+bi", "Modulus", "Angle", "Euler", "Multiply"]),
    ("Set ops", ["Union", "Intersect", "Diff", "Complement", "Cardinality"]),
    ("Big-O compare", ["O(1)", "O(log n)", "O(n)", "O(n log n)", "O(n²)"]),
    ("Recurrence master", ["T(n)=aT(n/b)+f(n)", "Case 1", "Case 2", "Case 3", "Theta"]),
    ("Probability chain", ["P(A)", "P(B|A)", "Joint", "Bayes", "Decide"]),
    ("Expected value", ["X", "p(x)", "Sum", "Linearity", "Variance"]),
    ("Hypothesis test", ["H0", "H1", "p-value", "α", "Conclude"]),
    ("Confidence interval", ["Sample", "SE", "z*", "Margin", "Interval"]),
]

BUILDING = [
    ("Service mesh", ["Service A", "Sidecar", "Control", "Service B", "Policy"]),
    ("Multi-region", ["Region A", "Replica", "Global LB", "Region B", "DR"]),
    ("Data center tiers", ["Tier I", "Tier II", "Tier III", "Tier IV", "Uptime"]),
    ("App tiers", ["Web", "App", "Cache", "DB", "Archive"]),
    ("Growth stages", ["Startup", "Scale-up", "Enterprise", "Global", "Optimize"]),
    ("Team growth", ["Solo", "Pod", "Squad", "Department", "Org"]),
    ("Traffic growth", ["KB/s", "MB/s", "GB/s", "TB/s", "Fan-out"]),
    ("Storage tiers", ["Hot", "Warm", "Cold", "Archive", "Glacier"]),
    ("Latency budget", ["DNS", "TLS", "TTFB", "Render", "TTI"]),
    ("Cost towers", ["Compute", "Storage", "Egress", "License", "Support"]),
    ("Skill stack", ["Syntax", "Libs", "Patterns", "System", "Leadership"]),
    ("Library deps", ["Core", "Util", "Net", "Crypto", "Test"]),
    ("Framework layers", ["Router", "Controller", "Service", "Repo", "DB"]),
    ("Mobile sizes", ["Phone", "Phablet", "Tablet", "Desktop", "TV"]),
    ("Video quality", ["144p", "480p", "720p", "1080p", "4K"]),
]

COMPARE = [
    ("Sync vs async", "Synchronous call", "Asynchronous call"),
    ("SQL vs NoSQL", "Relational rows", "Flexible documents"),
    ("Monolith vs micro", "Single deploy", "Many services"),
    ("TCP vs UDP", "Reliable stream", "Fast datagrams"),
    ("Heap vs stack", "Dynamic alloc", "Frame local"),
    ("Process vs thread", "Isolation", "Shared memory"),
    ("Compile vs interpret", "Ahead-of-time", "Runtime"),
    ("Strong vs eventual", "Immediate consistency", "Converge later"),
    ("Vertical vs horizontal", "Bigger machine", "More machines"),
    ("Push vs pull", "Server push", "Client poll"),
]

BANK = [
    "Retail payment flow",
    "Card auth path",
    "ACH outline",
    "Wire transfer",
    "Fraud scoring path",
]


def spacing_for(i: int) -> float:
    return float(180 + (i % 7) * 18)


def main() -> None:
    presets: list[dict] = []
    pid = 0

    def add(base: str, params: dict) -> None:
        nonlocal pid
        presets.append({"id": f"ep_{pid:03d}", "base": base, "params": params})
        pid += 1

    for i, (title, labels) in enumerate(FLOW):
        n = len(labels)
        add(
            "flow_chain",
            {
                "title": title,
                "count": n,
                "labels": labels,
                "spacing": spacing_for(i),
                "routing_mode": "elbow_auto" if i % 2 == 0 else "elbow_horizontal_first",
                "multi_arrow": i % 5 == 0,
            },
        )

    for i, (title, labels) in enumerate(ORG):
        add(
            "org_diagram",
            {
                "title": title,
                "count": max(3, len(labels) - 1),
                "labels": labels,
                "spacing": spacing_for(i + 40),
            },
        )

    for i, (title, labels) in enumerate(SWIM):
        add(
            "process_swimlane",
            {
                "title": title,
                "count": len(labels),
                "labels": labels,
                "spacing": 200.0,
            },
        )

    for i, title in enumerate(RECAP_TITLES):
        add(
            "recap_board",
            {
                "title": title,
                "recap": "• Concept A — definition\n• Concept B — when to use\n• Concept C — common mistake\n• Next: practice & apply",
                "text_duration": 0.65 + (i % 5) * 0.05,
                "shape_duration": 0.7 + (i % 4) * 0.05,
            },
        )

    for i, (title, labels) in enumerate(TIMELINE):
        add(
            "timeline_pack",
            {
                "title": title,
                "count": len(labels),
                "labels": labels,
            },
        )

    for i, (title, labels) in enumerate(FORMULA_FLOW):
        add(
            "formula_vector_flow",
            {
                "title": title,
                "count": len(labels),
                "labels": labels,
                "formula": labels[0] if labels else "flow",
                "spacing": spacing_for(i + 100),
                "multi_arrow": i % 3 == 0,
            },
        )

    for i, (mtitle, labels) in enumerate(MATH_PACK):
        add(
            "math_formula_pack",
            {
                "title": mtitle[:48],
                "labels": labels,
                "count": 3,
            },
        )

    for i, (title, labels) in enumerate(BUILDING):
        add(
            "building_city_pack",
            {
                "title": title,
                "count": len(labels),
                "labels": labels,
                "spacing": 130.0 + (i % 4) * 12.0,
            },
        )

    for i, (t, left, right) in enumerate(COMPARE):
        add(
            "house_bank_compare",
            {
                "title": t,
                "left_title": left,
                "right_title": right,
            },
        )

    for title in BANK:
        add("bank_flow_journey", {"title": title})

    # Pad with varied flow_chain if short of 250
    extra_titles = [
        ("Leetcode pattern", ["Two pointers", "Sliding window", "Binary search"]),
        ("System bits", ["Client", "LB", "App", "Cache", "DB"]),
        ("DSA review", ["Array", "Hash map", "Tree", "Graph", "Heap"]),
        ("OS basics", ["Kernel", "Syscall", "Process", "Thread", "IPC"]),
        ("Net stack", ["App", "TCP", "IP", "Link", "Physical"]),
    ]
    while len(presets) < 250:
        t, labs = extra_titles[len(presets) % len(extra_titles)]
        add(
            "flow_chain",
            {
                "title": f"{t} {len(presets)}",
                "count": len(labs),
                "labels": labs,
                "spacing": spacing_for(len(presets)),
            },
        )

    presets = presets[:250]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"version": 1, "presets": presets}, indent=2), encoding="utf-8")
    print(f"Wrote {len(presets)} presets to {OUT}")


if __name__ == "__main__":
    main()
