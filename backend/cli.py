"""CLI commands: seed database, run migrations."""
from database import SessionLocal, init_db


def migrate():
    """Run database migrations (create tables, add missing columns)."""
    init_db()
    print("Database migration complete.")


def varin_insights():
    """Print Varin telemetry summary (last N days; pass days as first CLI arg, default 14)."""
    from services.varin_telemetry import print_insights_report

    print_insights_report()


from models import Challenge, TechnicalQuestion, User, TrendingRole, RoadmapTopic, RoadmapTopicEdge


def seed():
    """Seed database with initial challenges and questions."""
    init_db()
    db = SessionLocal()
    try:
        # Create anonymous user for open access
        if not db.query(User).filter(User.email == "anonymous@ezilearning.local").first():
            db.add(User(email="anonymous@ezilearning.local", password_hash="", full_name="Guest"))
            db.commit()
            print("Seeded anonymous user")

        if db.query(Challenge).count() == 0:
            challenges = [
                {
                    "title": "Two Sum",
                    "description": "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nExample: nums = [2, 7, 11, 15], target = 9 -> [0, 1]",
                    "difficulty": "easy",
                    "language": "python",
                    "starter_code": "def two_sum(nums: list[int], target: int) -> list[int]:\n    \"\"\"Return indices of two numbers that add up to target.\"\"\"\n    pass",
                    "test_cases": [
                        {"input": "[2, 7, 11, 15], 9", "expected_output": "[0, 1]", "is_hidden": False},
                        {"input": "[3, 2, 4], 6", "expected_output": "[1, 2]", "is_hidden": True},
                    ],
                    "required_skills": ["Python", "Algorithms"],
                },
                {
                    "title": "FizzBuzz",
                    "description": "Print numbers 1 to n. For multiples of 3 print 'Fizz', multiples of 5 print 'Buzz', both print 'FizzBuzz'.",
                    "difficulty": "easy",
                    "language": "python",
                    "starter_code": "def fizzbuzz(n: int) -> list[str]:\n    \"\"\"Return list of FizzBuzz strings for 1 to n.\"\"\"\n    pass",
                    "test_cases": [
                        {"input": "15", "expected_output": "['1','2','Fizz','4','Buzz','Fizz','7','8','Fizz','Buzz','11','Fizz','13','14','FizzBuzz']", "is_hidden": False},
                    ],
                    "required_skills": ["Python"],
                },
            ]
            for c in challenges:
                db.add(Challenge(**c))
            print("Seeded challenges")

        if db.query(TechnicalQuestion).count() == 0:
            questions = [
                {"question_text": "Explain the difference between list and tuple in Python.", "answer_text": "Lists are mutable, tuples are immutable. Lists use [], tuples use ().", "skill_name": "Python", "difficulty": "easy", "category": "conceptual"},
                {"question_text": "What is the time complexity of binary search?", "answer_text": "O(log n) for sorted arrays.", "skill_name": "Algorithms", "difficulty": "easy", "category": "conceptual"},
                {"question_text": "Explain REST API principles.", "answer_text": "Stateless, resource-based, HTTP methods (GET, POST, PUT, DELETE).", "skill_name": "API", "difficulty": "medium", "category": "conceptual"},
                {"question_text": "What is a closure in JavaScript?", "answer_text": "A function that retains access to variables from its enclosing scope.", "skill_name": "JavaScript", "difficulty": "medium", "category": "conceptual"},
                {"question_text": "Describe the CAP theorem.", "answer_text": "Consistency, Availability, Partition tolerance - you can only guarantee two of three.", "skill_name": "System Design", "difficulty": "hard", "category": "conceptual"},
            ]
            for q in questions:
                db.add(TechnicalQuestion(**q))
            print("Seeded questions")

        if db.query(TrendingRole).count() == 0:
            roles = [
                {"name": "Frontend Developer", "description": "Build user interfaces with React, Vue, or Angular", "skills": ["HTML", "CSS", "JavaScript", "TypeScript", "React"], "popularity_score": 95},
                {"name": "Backend Developer", "description": "Server-side development with Node, Python, or Java", "skills": ["Python", "Node.js", "SQL", "REST API", "Docker"], "popularity_score": 90},
                {"name": "Full Stack Developer", "description": "End-to-end web development", "skills": ["React", "Node.js", "PostgreSQL", "AWS", "Git"], "popularity_score": 92},
                {"name": "Data Scientist", "description": "Analyze data and build ML models", "skills": ["Python", "Pandas", "NumPy", "Machine Learning", "SQL"], "popularity_score": 88},
                {"name": "DevOps Engineer", "description": "CI/CD, cloud, and infrastructure", "skills": ["Docker", "Kubernetes", "AWS", "Terraform", "Linux"], "popularity_score": 85},
            ]
            for r in roles:
                db.add(TrendingRole(**r))
            print("Seeded trending roles")

        if db.query(RoadmapTopic).count() == 0:
            topics_data = [
                ("HTML & CSS", "html-css", None, 0),
                ("JavaScript Basics", "js-basics", None, 1),
                ("React", "react", None, 2),
                ("TypeScript", "typescript", None, 3),
                ("Node.js", "nodejs", None, 4),
                ("Python Basics", "python-basics", None, 5),
                ("Data Structures", "data-structures", None, 6),
                ("Algorithms", "algorithms", None, 7),
                ("Binary Search", "binary-search", None, 8),
                ("Sorting", "sorting", None, 9),
                ("REST API", "rest-api", None, 10),
                ("SQL", "sql", None, 11),
                ("System Design", "system-design", None, 12),
            ]
            topic_ids = {}
            for name, slug, parent, idx in topics_data:
                t = RoadmapTopic(name=name, slug=slug, parent_id=parent, order_index=idx)
                db.add(t)
                db.flush()
                topic_ids[slug] = t.id
            # Add edges: html-css -> js -> react -> typescript, python -> ds -> algorithms
            edges = [
                ("html-css", "js-basics"),
                ("js-basics", "react"),
                ("react", "typescript"),
                ("python-basics", "data-structures"),
                ("data-structures", "algorithms"),
                ("algorithms", "binary-search"),
                ("algorithms", "sorting"),
            ]
            for from_slug, to_slug in edges:
                if from_slug in topic_ids and to_slug in topic_ids:
                    db.add(RoadmapTopicEdge(from_topic_id=topic_ids[from_slug], to_topic_id=topic_ids[to_slug]))
            print("Seeded roadmap topics")

        db.commit()
        print("Seed complete")
    finally:
        db.close()
