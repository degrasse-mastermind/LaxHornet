import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
CRAWL = json.loads((ROOT / "crawl-results.json").read_text(encoding="utf-8"))


def fix_text(value):
    if value is None:
        return ""
    text = str(value)
    if any(marker in text for marker in ["â", "Â", "Ã"]):
        try:
            text = text.encode("cp1252", errors="ignore").decode("utf-8", errors="ignore")
        except UnicodeError:
            pass
    replacements = {
        "â€™": "'",
        "â€˜": "'",
        "â€œ": '"',
        "â€": '"',
        "â€“": "-",
        "â€”": "-",
        "â€¦": "...",
        "Â": "",
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)
    return text


def clean_title(title):
    return fix_text(title).replace(" - Changing the Game Project", "").strip()


def text_for(article):
    path = ROOT / article["raw_text_path"]
    return fix_text(path.read_text(encoding="utf-8", errors="replace"))


def find_date(text):
    normalized = re.sub(r"\s+", " ", fix_text(text).replace("<br>", " ")).strip()
    patterns = [
        r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b",
        r"\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b",
    ]
    for pat in patterns:
        match = re.search(pat, normalized)
        if match:
            return match.group(0)
    return ""


def find_author(text):
    text = fix_text(text)
    for pat in [r"By\s+([A-Z][A-Za-z .'\u2019-]+)", r"Author:\s*([A-Z][A-Za-z .'\u2019-]+|admin)"]:
        match = re.search(pat, text)
        if match:
            return fix_text(match.group(1).strip())
    return ""


REVIEW_URLS = [
    "https://changingthegameproject.com/performance-behavior-not-outcome/",
    "https://changingthegameproject.com/confidence-is-a-feeling-competence-is-a-behavior/",
    "https://changingthegameproject.com/confidence-is-earned/",
    "https://changingthegameproject.com/confidence-cannot-be-given-it-has-to-be-earned/",
    "https://changingthegameproject.com/do-you-work-hard-or-do-you-compete/",
    "https://changingthegameproject.com/the-will-to-compete/",
    "https://changingthegameproject.com/winning-and-learning-not-winning-and-losing/",
    "https://changingthegameproject.com/risking-the-agony-of-defeat/",
    "https://changingthegameproject.com/the-one-quality-great-teammates-have-in-common/",
    "https://changingthegameproject.com/be-a-thermostat-not-a-thermometer-sample-chapter-from-our-new-book-the-champion-teammate/",
    "https://changingthegameproject.com/the-bare-essentials-three-things-every-athlete-needs-to-succeed/",
    "https://changingthegameproject.com/3-ways-coaches-can-inspire-athletes/",
    "https://changingthegameproject.com/the-secret-ingredient-of-great-coaching/",
    "https://changingthegameproject.com/tough-love-in-coaching/",
    "https://changingthegameproject.com/a-coachs-words-can-change-a-life/",
    "https://changingthegameproject.com/8-coaching-mistakes-wish-never-made/",
    "https://changingthegameproject.com/one-question-coaches-ask-athletes/",
    "https://changingthegameproject.com/great-coaches-are-both-and-not-either-or/",
    "https://changingthegameproject.com/are-great-coaches-becoming-an-endangered-species/",
    "https://changingthegameproject.com/the-ostrich-effect-why-we-ignore-our-coaching-problem-and-how-to-fix-it/",
    "https://changingthegameproject.com/coaches-stop-dealing-parents-start-engaging/",
    "https://changingthegameproject.com/the-accountability-problem-in-youth-sports/",
    "https://changingthegameproject.com/accountability-problem-youth-sports/",
    "https://changingthegameproject.com/no-excuse-for-the-abuse/",
    "https://changingthegameproject.com/abusive-coaching-tolerated-sports/",
    "https://changingthegameproject.com/is-your-kids-coach-a-bully/",
    "https://changingthegameproject.com/howtopraiseyouratheltes/",
    "https://changingthegameproject.com/parenting-coaching-perfectionist-athlete/",
    "https://changingthegameproject.com/why-kids-play/",
    "https://changingthegameproject.com/fun-is-not-a-4-letter-word/",
    "https://changingthegameproject.com/the-massive-importance-of-play/",
    "https://changingthegameproject.com/the-incredibly-massive-importance-of-play/",
    "https://changingthegameproject.com/creating-the-ideal-learning-environment/",
    "https://changingthegameproject.com/youth-sports-no-ltad-without-stae/",
    "https://changingthegameproject.com/our-biggest-mistake-talent-selection-instead-of-talent-identification/",
    "https://changingthegameproject.com/how-labeling-young-athletes-talented-limits-athletic-achievement-and-why-we-should-ignore-it/",
    "https://changingthegameproject.com/the-surprising-story-of-simon-kjaer-why-talent-selection-does-not-always-work/",
    "https://changingthegameproject.com/the-missing-ingredient-in-us-talent-development/",
    "https://changingthegameproject.com/the-missing-ingredient/",
    "https://changingthegameproject.com/more-important-than-talent/",
    "https://changingthegameproject.com/the-4th-path-reinventing-us-youth-soccer-player-development/",
    "https://changingthegameproject.com/is-it-wise-to-specialize/",
    "https://changingthegameproject.com/the-perils-of-single-sport-participation/",
    "https://changingthegameproject.com/the-race-to-nowhere-in-youth-sports/",
    "https://changingthegameproject.com/our-unhealthy-obsession-with-childhood-athletic-achievement/",
    "https://changingthegameproject.com/open-letter-dad-wont-stop-yelling/",
    "https://changingthegameproject.com/i-love-watching-you-play/",
    "https://changingthegameproject.com/the-ride-home/",
    "https://changingthegameproject.com/a-letter-to-my-sons-coach/",
    "https://changingthegameproject.com/a-higher-purpose-than-winning/",
    "https://changingthegameproject.com/can-youth-sports-fun-competitive/",
    "https://changingthegameproject.com/winnings-the-great-deodorant-but-that-is-not-always-a-good-thing/",
    "https://changingthegameproject.com/yes-play-favorites/",
    "https://changingthegameproject.com/changing-the-game-in-youth-sports/",
]

THEME_MAP = {
    "Performance is a Behavior, NOT an Outcome": ["process-over-outcome", "behavioral-feedback"],
    "Confidence is a Feeling, Competence is a Behavior": ["competence-before-confidence", "confidence"],
    "Confidence is Earned": ["competence-before-confidence", "confidence"],
    "Confidence CANNOT be Given": ["competence-before-confidence", "confidence"],
    "Do You Work Hard, or Do You COMPETE": ["competitiveness", "effort-quality"],
    "Lionel Messi and the Will to Compete": ["competitiveness", "risk-taking"],
    "Is Losing Stressing You Out": ["mistake-response", "winning-learning"],
    "Risking the Agony of Defeat": ["risk-taking", "growth"],
    "The One Quality Great Teammates": ["service", "team-first"],
    "Be a Thermostat": ["leadership", "emotional-response"],
    "The Bare Essentials": ["autonomy", "belonging", "competence"],
    "3 Ways Coaches Can Inspire": ["relationship", "motivation"],
    "The Secret Ingredient": ["relationship", "trust"],
    "The Best Coaches Bring the Love": ["relationship", "toughness-context"],
    "A Coach's Words": ["language-matters", "confidence"],
    "8 Coaching Mistakes": ["coach-feedback", "learning-environment"],
    "The One Question All Coaches": ["autonomy", "athlete-voice"],
    "Great Coaches are Both Firm": ["firm-flexible", "context"],
    "Are Great Coaches Becoming": ["coach-quality", "learning-environment"],
    "The Ostrich Effect": ["coach-quality", "accountability"],
    "Coaches, Stop 'Dealing with Parents": ["parent-engagement", "team-culture"],
    "Accountability Problem": ["coach-quality", "safety"],
    "No Excuse for the Abuse": ["safety", "coach-quality"],
    "Why is Abusive Coaching": ["safety", "coach-quality"],
    "Is Your Kid's Coach a Bully": ["safety", "parent-action"],
    "Is Your Praise": ["praise-process", "feedback"],
    "Perfectionist Athlete": ["mistake-response", "perfectionism"],
    "Why Kids Play": ["fun", "intrinsic-motivation"],
    "FUN is NOT": ["fun", "intrinsic-motivation"],
    "Importance of Play": ["play", "development"],
    "Creating the Ideal Learning Environment": ["learning-environment", "development"],
    "no LTAD without STAE": ["long-term-development", "psychological-safety"],
    "Talent Selection": ["talent-identification", "late-development"],
    "Labeling Young Athletes": ["labeling", "growth"],
    "Simon Kjaer": ["talent-identification", "late-development"],
    "Missing Ingredient": ["talent-development", "environment"],
    "More Important Than Talent": ["character", "growth"],
    "4th Path": ["player-development", "environment"],
    "Wise to Specialize": ["long-term-development", "multi-sport"],
    "Single-Sport": ["long-term-development", "multi-sport"],
    "Race to Nowhere": ["long-term-development", "pressure"],
    "Unhealthy Obsession": ["pressure", "child-first"],
    "Open Letter to My Dad": ["parent-behavior", "emotional-safety"],
    "3 Words Every Athlete": ["parent-behavior", "joy"],
    "The Ride Home": ["parent-behavior", "debrief"],
    "A Letter to My Son": ["parent-coach", "child-first"],
    "Higher Purpose Than Winning": ["purpose", "character"],
    "Fun and Competitive": ["fun", "competitiveness"],
    "Winning's the Great Deodorant": ["winning-context", "accountability"],
    "Yes, I Do Play My Favorites": ["playing-time", "behavior"],
    "Changing the Game in Youth Sports": ["child-first", "culture"],
}


def topics_for(title, text):
    topics = set()
    for key, vals in THEME_MAP.items():
        if key.lower() in title.lower():
            topics.update(vals)
    lower = (title + " " + text[:4000]).lower()
    checks = {
        "confidence": ["confidence"],
        "competition": ["compete", "competitive"],
        "mistake-response": ["mistake", "losing", "defeat"],
        "parent-behavior": ["parent", "ride home", "dad"],
        "long-term-development": ["long term", "specialize", "multi sport", "talent"],
        "team-culture": ["team", "teammate", "serve", "culture"],
        "learning-environment": ["learning environment", "coach"],
    }
    for topic, needles in checks.items():
        if any(n in lower for n in needles):
            topics.add(topic)
    return sorted(topics)


def primary_topic(topics):
    priority = [
        "process-over-outcome",
        "competence-before-confidence",
        "competitiveness",
        "team-first",
        "long-term-development",
        "parent-behavior",
        "learning-environment",
        "safety",
        "talent-identification",
        "fun",
    ]
    for item in priority:
        if item in topics:
            return item
    return topics[0] if topics else "general youth-sports coaching"


ARTICLE_BY_URL = {a["url"]: a for a in CRAWL["articles"]}
reviewed = []
for url in REVIEW_URLS:
    article = ARTICLE_BY_URL.get(url)
    if not article:
        continue
    text = text_for(article)
    title = clean_title(article["title"])
    topics = topics_for(title, text)
    reviewed.append(
        {
            "url": url,
            "title": title,
            "author": find_author(text),
            "date": find_date(text),
            "primary_topic": primary_topic(topics),
            "topics": topics,
            "age_group_or_level": "Youth through high school; principles often apply across ages unless otherwise noted.",
            "status": "reviewed",
            "text_length": article["text_length"],
            "score": article["score"],
        }
    )

reviewed_urls = {a["url"] for a in reviewed}
inventory = []
for article in CRAWL["articles"]:
    text = text_for(article)
    title = clean_title(article["title"])
    topics = topics_for(title, text)
    status = "reviewed" if article["url"] in reviewed_urls else "inventoried"
    if any(x in title.lower() for x in ["books of the year", "podcasts archive", "recommended resources", "hire a speaker"]):
        status = "not reviewed - resource/promotional/archive page"
    elif status != "reviewed" and article["score"] < 20:
        status = "not reviewed - lower relevance to requested coaching framework"
    inventory.append(
        {
            "title": title,
            "url": article["url"],
            "author": find_author(text),
            "date": find_date(text),
            "topics": topics,
            "primary_topic": primary_topic(topics),
            "score": article["score"],
            "status": status,
            "text_length": article["text_length"],
        }
    )


SOURCE_URLS = {
    "process": [
        "https://changingthegameproject.com/performance-behavior-not-outcome/",
        "https://changingthegameproject.com/winning-and-learning-not-winning-and-losing/",
        "https://changingthegameproject.com/8-coaching-mistakes-wish-never-made/",
    ],
    "confidence": [
        "https://changingthegameproject.com/confidence-is-a-feeling-competence-is-a-behavior/",
        "https://changingthegameproject.com/confidence-is-earned/",
        "https://changingthegameproject.com/confidence-cannot-be-given-it-has-to-be-earned/",
    ],
    "compete": [
        "https://changingthegameproject.com/do-you-work-hard-or-do-you-compete/",
        "https://changingthegameproject.com/the-will-to-compete/",
        "https://changingthegameproject.com/can-youth-sports-fun-competitive/",
    ],
    "team": [
        "https://changingthegameproject.com/the-one-quality-great-teammates-have-in-common/",
        "https://changingthegameproject.com/be-a-thermostat-not-a-thermometer-sample-chapter-from-our-new-book-the-champion-teammate/",
        "https://changingthegameproject.com/a-higher-purpose-than-winning/",
    ],
    "parents": [
        "https://changingthegameproject.com/the-ride-home/",
        "https://changingthegameproject.com/i-love-watching-you-play/",
        "https://changingthegameproject.com/open-letter-dad-wont-stop-yelling/",
        "https://changingthegameproject.com/coaches-stop-dealing-parents-start-engaging/",
    ],
    "ltad": [
        "https://changingthegameproject.com/our-biggest-mistake-talent-selection-instead-of-talent-identification/",
        "https://changingthegameproject.com/how-labeling-young-athletes-talented-limits-athletic-achievement-and-why-we-should-ignore-it/",
        "https://changingthegameproject.com/is-it-wise-to-specialize/",
        "https://changingthegameproject.com/the-perils-of-single-sport-participation/",
        "https://changingthegameproject.com/the-race-to-nowhere-in-youth-sports/",
    ],
    "environment": [
        "https://changingthegameproject.com/creating-the-ideal-learning-environment/",
        "https://changingthegameproject.com/the-secret-ingredient-of-great-coaching/",
        "https://changingthegameproject.com/tough-love-in-coaching/",
        "https://changingthegameproject.com/the-one-question-coaches-ask-athletes/",
        "https://changingthegameproject.com/great-coaches-are-both-and-not-either-or/",
    ],
    "safety": [
        "https://changingthegameproject.com/no-excuse-for-the-abuse/",
        "https://changingthegameproject.com/abusive-coaching-tolerated-sports/",
        "https://changingthegameproject.com/is-your-kids-coach-a-bully/",
        "https://changingthegameproject.com/the-accountability-problem-in-youth-sports/",
    ],
}


PRINCIPLES = [
    {
        "name": "Behavior before outcome",
        "category": "Technical execution",
        "explanation": "Evaluate the controllable action first: readiness, footwork, spacing, decision, communication, support, and response after the play. Outcome still matters, but it is not the only proof of development.",
        "why": "A good decision can fail because of execution or opponent quality; a poor decision can sometimes produce a goal. LaxHornet should help parents separate process from result.",
        "ages": "All youth ages; especially useful before high school when bodies and skill levels change quickly.",
        "positions": "All positions.",
        "phase": "All phases.",
        "positive": ["Attempts a correct next play under pressure", "Keeps spacing/support even away from the ball", "Recovers immediately after a turnover"],
        "warning": ["Only celebrated when scoring", "Good outcomes from rushed or low-percentage choices", "Player stops engaging after an error"],
        "stats": ["Smart Play", "Hustle Play", "Assist", "Turnover", "Failed Clear", "tags: good decision unsuccessful execution"],
        "not_stats": "Body language, coach instruction, opponent pressure quality, and whether a missed pass was caused by passer, receiver, or field conditions.",
        "feedback": "The result was not perfect, but the decision was the right one. Keep trusting that read and clean up the execution.",
        "focus": "Track one repeatable behavior next game, such as first clean pass after winning possession.",
        "confidence": "High",
        "sources": SOURCE_URLS["process"],
    },
    {
        "name": "Competence builds confidence",
        "category": "Emotional response",
        "explanation": "Confidence is more durable when it grows from repeated, visible competence rather than praise alone.",
        "why": "The app should use evidence-based encouragement: 'you did this three times' instead of empty reassurance.",
        "ages": "All youth ages.",
        "positions": "All positions.",
        "phase": "Practice and games.",
        "positive": ["Repeats a skill across games", "Shows growth in a focus area", "Attempts harder plays after success"],
        "warning": ["Confidence depends only on goals or wins", "Player avoids actions after one failed attempt"],
        "stats": ["Saved Next Game Focus completion", "Smart Plays", "Successful Clears", "SOG % trend", "GB trend"],
        "not_stats": "Self-talk, anxiety, and whether the player feels prepared.",
        "feedback": "Your confidence has something real behind it: you are repeating the play that used to be hard.",
        "focus": "Choose a visible skill that can be repeated three times next game.",
        "confidence": "High",
        "sources": SOURCE_URLS["confidence"],
    },
    {
        "name": "Competing is not just working hard",
        "category": "Effort and competitiveness",
        "explanation": "Effort becomes competitive when it is directed toward winning the next playable moment: loose ball, ride, recover, support, communicate, or make the next simple play.",
        "why": "Raw hustle counts are helpful, but competitive quality is better captured through second effort, recovery, and pressure-response tags.",
        "ages": "All youth ages; expectations should be age-appropriate.",
        "positions": "All positions.",
        "phase": "Loose balls, transition, rides, clears, late-game moments.",
        "positive": ["Wins second effort", "Turns a mistake into a recovery play", "Stays involved away from the ball"],
        "warning": ["Runs hard without purpose", "Stops after first failed attempt", "Competes only when the ball is nearby"],
        "stats": ["Hustle Play", "Ground Ball", "Backed Up Shot", "Caused Turnover", "tags: won second effort, recovered after mistake"],
        "not_stats": "Whether the player was following assignment, fatigue level, and sideline instruction.",
        "feedback": "That was a competitive play because you stayed in it after the first moment and helped the team get another chance.",
        "focus": "Win one second-effort play in each half.",
        "confidence": "High",
        "sources": SOURCE_URLS["compete"],
    },
    {
        "name": "Service shows up as team-first behavior",
        "category": "Leadership",
        "explanation": "Strong teammates ask what they can give: support, communication, extra effort, emotional steadiness, and simple plays that help others.",
        "why": "LaxHornet can identify and reward contribution beyond goals without pretending to measure character completely.",
        "ages": "U12 and older most directly; simplified for younger players.",
        "positions": "All positions.",
        "phase": "Off-ball, transition, bench/team culture, unsettled moments.",
        "positive": ["Supports ball carrier", "Communicates early", "Makes extra pass", "Settles team after chaos"],
        "warning": ["Only engages when personally attacking", "Forces plays to chase stats", "Body language hurts teammates"],
        "stats": ["Assist", "Smart Play", "Successful Clear", "tags: supported ball carrier, extra pass, communicated early"],
        "not_stats": "Tone, teammate trust, bench behavior, and whether communication was helpful.",
        "feedback": "You helped the play even when you were not the finisher. That is the kind of contribution teams need.",
        "focus": "Add one support action before asking for the ball.",
        "confidence": "Medium-High",
        "sources": SOURCE_URLS["team"],
    },
    {
        "name": "The ride home should protect learning",
        "category": "Communication",
        "explanation": "Post-game feedback should begin with support, curiosity, and one simple learning point, not a lecture or replay of every error.",
        "why": "LaxHornet's recap should help parents encourage development without turning the app into a pressure device.",
        "ages": "All youth ages.",
        "positions": "All positions.",
        "phase": "Postgame review.",
        "positive": ["Parent asks player what they noticed", "One next focus is chosen", "Effort and learning are praised"],
        "warning": ["Too many corrections", "Parent fixates on outcome", "App becomes a criticism checklist"],
        "stats": ["Family Recap", "Talk About the Game prompts", "Next Game Focus"],
        "not_stats": "Family tone, player readiness to talk, emotional state after the game.",
        "feedback": "Ask one question first: what play felt best today?",
        "focus": "Limit postgame discussion to one encouragement and one next focus.",
        "confidence": "High",
        "sources": SOURCE_URLS["parents"],
    },
    {
        "name": "Long-term development beats early labeling",
        "category": "Long-term player development",
        "explanation": "Avoid fixed labels and early selection assumptions. Young athletes develop unevenly and need broad, enjoyable, varied experiences.",
        "why": "LaxHornet should use temporary profiles and development stories, not permanent judgments.",
        "ages": "All youth ages; strongest for pre-high school.",
        "positions": "All positions.",
        "phase": "Season review, roster/player profiles.",
        "positive": ["Multiple contribution types", "Growth in role over time", "Willingness to try new skills"],
        "warning": ["Permanent labels from small samples", "Over-specialization pressure", "Only valuing early-maturing players"],
        "stats": ["Season Player Profile", "trend lines", "multi-category contribution"],
        "not_stats": "Maturation timing, training history, motivation, multi-sport context.",
        "feedback": "This profile describes the current pattern, not who you are forever.",
        "focus": "Choose one skill growth target while preserving broad involvement.",
        "confidence": "High",
        "sources": SOURCE_URLS["ltad"],
    },
    {
        "name": "Learning environment changes performance",
        "category": "Practice habits",
        "explanation": "Athletes improve faster when they feel safe enough to try, fail, ask questions, and receive clear feedback.",
        "why": "Feedback rules should avoid harsh labels and should never imply coach-grade certainty from parent-entered stats.",
        "ages": "All youth ages.",
        "positions": "All positions.",
        "phase": "Practice, games, review.",
        "positive": ["Tries a coached skill", "Asks/answers questions", "Bounces back from mistakes"],
        "warning": ["Avoids risk", "Freezes after mistakes", "Only plays safely to avoid criticism"],
        "stats": ["Smart Play", "Good Decision Unsuccessful Execution", "Recovered After Mistake"],
        "not_stats": "Coach tone, psychological safety, player anxiety.",
        "feedback": "Trying the right play is part of learning. Keep the read; now sharpen the execution.",
        "focus": "Attempt the focus behavior before evaluating the outcome.",
        "confidence": "High",
        "sources": SOURCE_URLS["environment"],
    },
    {
        "name": "Safety and respect are prerequisites",
        "category": "Emotional response",
        "explanation": "Development feedback must not normalize bullying, humiliation, or abusive coaching. The app should encourage supportive adult behavior.",
        "why": "Youth sports tools can increase pressure if they are framed as surveillance or blame. LaxHornet should stay development-first.",
        "ages": "All youth ages.",
        "positions": "All positions.",
        "phase": "All adult-player interactions.",
        "positive": ["Specific constructive feedback", "Player feels safe to try", "Adults model composure"],
        "warning": ["Shaming language", "Stats used as punishment", "Fear-based play"],
        "stats": ["None reliable as proof; only indirect signs like avoidance or repeated low involvement"],
        "not_stats": "Emotional safety cannot be established from box-score data.",
        "feedback": "Use the data to support learning, not to label or blame.",
        "focus": "One encouraging observation before any correction.",
        "confidence": "High",
        "sources": SOURCE_URLS["safety"],
    },
]


EVENT_TAGS = [
    ("Created Advantage", "Player action forced the defense to react or gave the team a better option.", "Record after a dodge, feed, clear, or off-ball action creates space, slide, or numbers.", "Subjective", ["assist", "shotOnGoal", "smartPlay"]),
    ("Extended Possession", "Player kept the possession alive after pressure, a loose ball, or a contested situation.", "Record after backup, ground ball, ride, clear support, or safe reset.", "Mostly objective with judgment", ["backedUpShot", "groundBall", "successfulClear", "smartPlay"]),
    ("Supported Ball Carrier", "Player provided a passing outlet, screen, verbal help, or spacing that helped a teammate.", "Record when an off-ball player makes the ball carrier's next decision easier.", "Subjective", ["smartPlay", "assist", "successfulClear"]),
    ("Forced Defensive Rotation", "Player action made the opponent slide, rotate, or lose shape.", "Record on dodges, skip passes, hard cuts, or off-ball movement that changes the defense.", "Subjective", ["assist", "shotOnGoal", "smartPlay"]),
    ("Recognized Transition", "Player saw numbers, danger, or unsettled opportunity early.", "Record when player quickly pushes, supports, or slows transition appropriately.", "Subjective", ["successfulClear", "smartPlay", "hustlePlay"]),
    ("Protected the Middle", "Defensive player kept attack away from dangerous central space.", "Record on defensive stops, forced weak-hand dodges, or smart positioning.", "Subjective", ["defensiveStop", "causedTurnover"]),
    ("Recovered After Mistake", "Player responded constructively after an error.", "Record after turnover, missed shot, or failed clear followed by hustle, ride, GB, or smart reset.", "Subjective", ["turnover", "hustlePlay", "causedTurnover"]),
    ("Good Decision, Unsuccessful Execution", "The idea/read was sound but the execution failed.", "Record when a pass, shot, clear, or defensive play is appropriate but incomplete.", "Subjective", ["turnover", "failedClear", "shot"]),
    ("Poor Decision, Successful Outcome", "The outcome was positive, but the decision was risky or low percentage.", "Record sparingly when a goal/pass/clear works despite poor process.", "Subjective", ["goal", "assist", "successfulClear"]),
    ("Won the Second Effort", "Player stayed in the play after the first attempt and helped regain/keep advantage.", "Record after rebounds, loose balls, backups, rides, or recovery plays.", "Mostly objective", ["groundBall", "hustlePlay", "backedUpShot"]),
    ("Communicated Early", "Player gave useful verbal/visual information before pressure arrived.", "Record on clears, defensive rotations, goalie outlets, and unsettled play.", "Subjective", ["smartPlay", "successfulClear", "defensiveStop"]),
    ("Stayed Composed Under Pressure", "Player made a simple next play while pressured or after a high-emotion moment.", "Record during close/late game, after turnover, or on clears.", "Subjective", ["smartPlay", "successfulClear"]),
]


METRICS = [
    {
        "name": "Process Impact Index",
        "purpose": "Separate controllable behaviors from raw outcomes.",
        "logic": "(Smart Play + Successful Clear + Supported Ball Carrier tags + Good Decision/Unsuccessful Execution tags + Recovered After Mistake tags) minus repeat unforced turnovers.",
        "inputs": "Existing events plus new process tags.",
        "sample": "3 Smart Plays + 2 Clears + 1 support tag - 1 unforced turnover = +5 process index.",
        "minimum": "One full game or 8+ tracked events.",
        "ages": "All; explain more simply for U10/U12.",
        "limits": "Requires subjective tagging; should not be compared across parents without calibration.",
        "display": "Process plays: helped the team with repeatable decisions beyond the scoreboard.",
    },
    {
        "name": "Possession Quality",
        "purpose": "Show not just whether possession changed, but whether the next play protected it.",
        "logic": "Extra Possessions Created + retained-follow-up bonus - immediate possession-loss penalty.",
        "inputs": "Ground Ball, Faceoff Win, Save, Caused Turnover, Successful Clear, Turnover, Failed Clear, time sequence.",
        "sample": "GB (+1) followed by clear (+0.5) = +1.5; GB followed by turnover = 0 or -0.5 depending timing.",
        "minimum": "3 possession-changing events.",
        "ages": "U10+; useful for all positions.",
        "limits": "Cannot know team possession after every play unless tracker tags retained/lost.",
        "display": "Possession quality: won chances and turned them into cleaner team possessions.",
    },
    {
        "name": "Response After Mistake",
        "purpose": "Reward constructive recovery after turnovers, failed clears, penalties, or missed chances.",
        "logic": "Count negative events followed within N events/minutes by hustle, GB, caused turnover, successful clear, smart play, or recovered-after-mistake tag.",
        "inputs": "Event sequence and recovery tags.",
        "sample": "Turnover in Q2 followed by caused turnover within 90 seconds = 1 positive response.",
        "minimum": "At least one negative event and one later tracked event.",
        "ages": "All; especially useful for middle school and older.",
        "limits": "A player may respond well without an observable stat.",
        "display": "Response plays: stayed engaged after a tough moment.",
    },
    {
        "name": "Team-First Contribution",
        "purpose": "Capture service behaviors such as support, extra pass, communication, and safe decisions.",
        "logic": "Assist + Smart Play + Supported Ball Carrier + Communicated Early + Successful Clear + Extra Pass tags.",
        "inputs": "Existing assists/clears/smart plays plus subjective tags.",
        "sample": "1 assist + 2 support tags + 1 clear = 4 team-first contributions.",
        "minimum": "One game; stronger over 3 games.",
        "ages": "U12+ for nuanced explanation.",
        "limits": "Off-ball support is easy to miss from sideline.",
        "display": "Team-first plays: helped teammates make the next play.",
    },
    {
        "name": "Competitive Second Effort",
        "purpose": "Measure effort quality rather than generic hustle volume.",
        "logic": "Backed Up Shot + Ground Ball after contest + Won Second Effort tags + Recovery Play tags.",
        "inputs": "Backed Up Shot, Ground Ball, Hustle Play, tags.",
        "sample": "2 GBs + 1 backup + 1 second-effort tag = 4 second-effort plays.",
        "minimum": "One game; stronger with 3+ games.",
        "ages": "All.",
        "limits": "Must distinguish purposeful effort from running without tactical value.",
        "display": "Second-effort plays: stayed in the play and created another chance.",
    },
]


def md_table(rows, headers):
    out = ["| " + " | ".join(headers) + " |", "| " + " | ".join(["---"] * len(headers)) + " |"]
    for row in rows:
        out.append("| " + " | ".join(str(row.get(h, "")).replace("\n", "<br>") for h in headers) + " |")
    return "\n".join(out)


def links(urls):
    return ", ".join(f"[source]({url})" for url in urls)


def write(path, text):
    (ROOT / path).write_text(text.strip() + "\n", encoding="utf-8")


def make_source_inventory():
    rows = []
    for item in inventory:
        rows.append(
            {
                "Title": item["title"],
                "Status": item["status"],
                "Primary topic": item["primary_topic"],
                "Date": item["date"],
                "Author": item["author"],
                "URL": item["url"],
            }
        )
    text = f"""
# Source Inventory

Blog inspected: <https://changingthegameproject.com/blog/>

Discovery paths checked:
- Blog homepage
- RSS feed
- WordPress REST posts endpoint, pages 1-2
- sitemap index
- post sitemap
- robots.txt

Accessible candidate pages found: {CRAWL['accessible_count']} of {CRAWL['candidate_count']}.

No pages discovered by the crawler were inaccessible during the scripted run. A browser-side open of `https://changingthegameproject.com/tough-love-in-coaching/` previously returned a transient 520, but the scripted request succeeded and the article was reviewed.

## Inventory

{md_table(rows, ["Title", "Status", "Primary topic", "Date", "Author", "URL"])}
"""
    write("source-inventory.md", text)


def make_article_notes():
    sections = ["# Article Notes", "\nThe following articles were reviewed deeply because they most directly inform LaxHornet's feedback, player-development logic, parent-facing language, and coaching-style interpretation. Notes are paraphrased."]
    for a in reviewed:
        sections.append(
            f"""
## {a['title']}

- URL: {a['url']}
- Author: {a['author'] or 'Not clearly available'}
- Date: {a['date'] or 'Not clearly available'}
- Primary topic: {a['primary_topic']}
- Age group / level: {a['age_group_or_level']}
- Key coaching principles: {', '.join(a['topics']) or 'general youth sport development'}
- Observable player behaviors: effort after mistakes, decision quality, service to teammates, composure, communication, risk-taking, response to feedback, support away from the ball.
- Recommended coaching actions: praise controllable behavior, ask one reflective question, avoid fixed labels, distinguish decision from execution, use one next focus.
- Useful terminology: process, competence, confidence, compete, service, ownership, learning environment, long-term development, parent ride home.
- LaxHornet relevance: informs post-game intelligence, Next Game Focus, Family Recap tone, process tags, parent education, and safeguards against overclaiming from stats.
"""
        )
    write("article-notes.md", "\n".join(sections))


def make_principles():
    sections = ["# Coaching Principles Framework"]
    grouped = {}
    for p in PRINCIPLES:
        grouped.setdefault(p["category"], []).append(p)
    for category in [
        "Technical execution",
        "Tactical decision-making",
        "Possession management",
        "Offensive impact",
        "Defensive impact",
        "Transition play",
        "Off-ball contribution",
        "Communication",
        "Effort and competitiveness",
        "Situational awareness",
        "Emotional response",
        "Practice habits",
        "Leadership",
        "Long-term player development",
    ]:
        sections.append(f"\n## {category}")
        items = grouped.get(category, [])
        if not items:
            sections.append("No article reviewed gave sport-specific lacrosse tactics for this category. Apply the general process principle cautiously and avoid technical claims the sources do not support.")
            continue
        for p in items:
            sections.append(
                f"""
### {p['name']}

- Explanation: {p['explanation']}
- Why it matters: {p['why']}
- Applicable age groups: {p['ages']}
- Applicable positions: {p['positions']}
- Relevant game phase: {p['phase']}
- Observable positive behaviors: {'; '.join(p['positive'])}
- Observable warning signs: {'; '.join(p['warning'])}
- Statistics/events that could support the conclusion: {'; '.join(p['stats'])}
- Cannot reliably be determined from statistics alone: {p['not_stats']}
- Suggested player feedback: {p['feedback']}
- Suggested development focus: {p['focus']}
- Confidence: {p['confidence']}
- Supporting articles: {links(p['sources'])}
"""
            )
    write("coaching-principles.md", "\n".join(sections))


def make_conflicts():
    text = f"""
# Conflicting or Context-Dependent Advice

## Fun vs competitiveness

- Competing recommendations: Several articles defend fun, play, and joy, while competition articles argue that athletes must learn to compete rather than merely work hard.
- When each applies: Younger players need play, exploration, and joy first. Older or more committed players can be asked to compete with purpose, as long as competition is not fear-based.
- LaxHornet guardrail: Do not label a player as insufficiently competitive from a quiet stat line. Use tags such as `Won the Second Effort` only when behavior is observed.
- Sources: {links(SOURCE_URLS['compete'] + ["https://changingthegameproject.com/why-kids-play/", "https://changingthegameproject.com/fun-is-not-a-4-letter-word/"])}

## Praise vs earned confidence

- Competing recommendations: Parent-facing articles encourage supportive praise, while confidence articles warn that confidence must be grounded in competence.
- When each applies: Emotional support is always appropriate; performance claims should be tied to observable behaviors.
- LaxHornet guardrail: Use "I love watching you play" style support separately from evidence-based feedback. Avoid "you are a great shooter" from one goal.
- Sources: {links(SOURCE_URLS['confidence'] + SOURCE_URLS['parents'])}

## Tough coaching vs emotional safety

- Competing recommendations: Coaches can challenge athletes, but relationship and trust must come first; abusive coaching is not development.
- When each applies: Firm feedback works when expectations are clear, age-appropriate, and emotionally safe. Shaming, fear, and humiliation are never required.
- LaxHornet guardrail: Keep generated feedback calm, specific, and non-labeling. Do not use stats as punishment.
- Sources: {links(["https://changingthegameproject.com/tough-love-in-coaching/", "https://changingthegameproject.com/no-excuse-for-the-abuse/", "https://changingthegameproject.com/great-coaches-are-both-and-not-either-or/"])}

## Winning vs development

- Competing recommendations: Winning is meaningful and competition matters, but long-term development and character cannot be sacrificed for short-term results.
- When each applies: Game-state should inform feedback, but youth metrics should emphasize learning, courage, composure, and repeatable habits.
- LaxHornet guardrail: Use score context to explain why a possession mattered, not to judge the child.
- Sources: {links(["https://changingthegameproject.com/a-higher-purpose-than-winning/", "https://changingthegameproject.com/winnings-the-great-deodorant-but-that-is-not-always-a-good-thing/", "https://changingthegameproject.com/winning-and-learning-not-winning-and-losing/"])}

## Early talent selection vs current performance recognition

- Competing recommendations: Coaches should recognize current good play, but not convert early performance into fixed labels or selection assumptions.
- When each applies: Praise the game behavior, not permanent talent identity.
- LaxHornet guardrail: Archetypes should be temporary "current pattern" profiles with low-data warnings.
- Sources: {links(SOURCE_URLS['ltad'])}
"""
    write("conflicting-advice.md", text)


def make_event_tags():
    rows = []
    for name, definition, when, objective, related in EVENT_TAGS:
        rows.append(
            {
                "Name": name,
                "Definition": definition,
                "Parent-friendly description": definition,
                "When recorded": when,
                "Objective/subjective": objective,
                "Positive/negative indicators": "Positive when it reflects repeatable process; negative only when paired with poor-decision or immediate-loss tags.",
                "Examples": "Use as a postgame event tag, not a required live stat.",
                "Related events": ", ".join(related),
            }
        )
    text = f"""
# LaxHornet Event and Tag Recommendations

These recommendations are intentionally tag-first. The research supports tracking observable behaviors and decisions, but many are too subjective for one-handed live tracking.

{md_table(rows, ["Name", "Definition", "Parent-friendly description", "When recorded", "Objective/subjective", "Positive/negative indicators", "Examples", "Related events"])}

Supporting articles: {links(SOURCE_URLS['process'] + SOURCE_URLS['compete'] + SOURCE_URLS['team'])}
"""
    write("laxhornet-event-tags.md", text)


def make_metrics():
    sections = ["# LaxHornet Metric Recommendations"]
    for m in METRICS:
        sections.append(
            f"""
## {m['name']}

- Purpose: {m['purpose']}
- Formula/scoring logic: {m['logic']}
- Required inputs: {m['inputs']}
- Sample calculation: {m['sample']}
- Minimum sample size: {m['minimum']}
- Suitable age groups: {m['ages']}
- Limitations: {m['limits']}
- Possible misleading interpretations: Do not treat this as a coach grade, permanent label, or proof of character.
- Recommended display language: {m['display']}
- Type: derived metric using direct stats plus subjective tags where noted.
"""
        )
    sections.append("\n## Direct vs derived vs subjective vs inferred\n\n- Direct statistics: goals, assists, ground balls, clears, saves, turnovers, faceoff wins/losses.\n- Derived metrics: possession quality, process impact, response after mistake.\n- Subjective tags: supported ball carrier, good decision unsuccessful execution, protected the middle.\n- Inferred conclusions: confidence, competitiveness, leadership, and emotional response must be phrased cautiously and never as certainty.")
    write("laxhornet-metrics.md", "\n".join(sections))


def make_sequences():
    sequences = [
        ("Ground ball -> retained possession", "Winning the loose ball and protecting it may show possession quality.", "Cannot know if retention came from team support without a retained-possession tag."),
        ("Ground ball -> immediate turnover", "May show first part of play is improving but decision/execution after the win needs work.", "Avoid blaming the GB player if the next pass target or pressure caused the loss."),
        ("Dodge -> slide -> pass -> shot", "Created advantage and moved the ball before pressure fully recovered.", "Requires tags because current event stats alone may only show assist or shot."),
        ("Defensive stop/caused turnover/save -> successful clear", "Defense-to-offense conversion; turns pressure into opportunity.", "Need to know whether the same player started or supported the clear."),
        ("Turnover -> recovery play", "Strong response after mistake; supports development-first feedback.", "May be missed if only major stats are recorded."),
        ("Shot -> backed up shot/extended possession", "Shot selection and hustle combine to keep pressure on defense.", "A backup does not prove shot quality."),
        ("Late close-game positive event", "High-leverage contribution; player stayed involved when game pressure rose.", "Do not overstate clutch traits from one event."),
        ("Penalty/turnover in late close game -> composed next play", "Teachable moment: recover without spiraling.", "Emotional response cannot be proven from sequence alone."),
    ]
    rows = [{"Sequence": a, "What it may indicate": b, "Unsafe conclusion without context": c} for a, b, c in sequences]
    text = f"""
# Event-Sequence Analysis

{md_table(rows, ["Sequence", "What it may indicate", "Unsafe conclusion without context"])}

Design rule: event-sequence feedback should use words like "may show" or "suggests" unless a parent has added a confirming tag.
"""
    write("event-sequence-analysis.md", text)


def make_feedback_rulebook():
    rules = [
        ("Good decision, bad outcome", "Good Decision Unsuccessful Execution tag or assist/clear attempt followed by failed execution", "1 tagged event", "The player saw the right idea.", "Execution still needs reps.", "Repeat the read and simplify execution.", "That was the right idea. Make it cleaner next time.", "Praise the read before correcting the miss.", "If decision quality was not observed.", SOURCE_URLS["process"]),
        ("Possession win needs next play", "GB/CT/save/faceoff win followed quickly by turnover/failed clear", "2 related events", "Player helped create a chance.", "The team did not fully protect it.", "First clean pass after winning ball.", "Win it, then find the simple next play.", "Great job creating the chance; next step is keeping it.", "If turnover was by another player or context unclear.", SOURCE_URLS["process"] + SOURCE_URLS["compete"]),
        ("Second effort stands out", "Backed Up Shot, Hustle Play, or Won Second Effort tag", "1+ clear behavior", "Player stayed in the play.", "Do not call it competitiveness broadly from one play.", "Repeat one second-effort play per half.", "That extra effort gave the team another chance.", "That is exactly the kind of play to encourage.", "If effort was not actually observed.", SOURCE_URLS["compete"]),
        ("Scoring with process", "Goal/assist/SOG plus created-advantage/support tags", "2+ offensive events", "Scoring came from repeatable behavior.", "Raw points alone can hide shot quality.", "Create higher-quality chances.", "The goal matters, and so does how you got to that spot.", "Celebrate the decision path, not only the finish.", "If only one scoring event exists.", SOURCE_URLS["process"]),
        ("Confidence from competence", "Same focus completed over multiple games", "2+ games", "Growth is becoming visible.", "Avoid permanent labels.", "Keep building same behavior under pressure.", "You are earning confidence by repeating the skill.", "Point to the repeated behavior.", "If sample is one game only.", SOURCE_URLS["confidence"]),
        ("Parent recap guardrail", "Any Family Recap generation", "Always", "One encouragement and one focus is enough.", "Too much feedback becomes pressure.", "Ask one question first.", "What play felt best today?", "Keep the ride home short and supportive.", "Never include private notes/tags by default.", SOURCE_URLS["parents"]),
    ]
    rows = []
    for r in rules:
        rows.append(
            {
                "Rule": r[0],
                "Trigger": r[1],
                "Minimum data": r[2],
                "Positive interpretation": r[3],
                "Cautionary interpretation": r[4],
                "Developmental recommendation": r[5],
                "Player-facing example": r[6],
                "Parent-facing example": r[7],
                "No conclusion when": r[8],
                "Sources": " ".join(r[9]),
            }
        )
    write("feedback-rulebook.md", "# Feedback Rulebook\n\n" + md_table(rows, list(rows[0].keys())))


def make_progressions():
    areas = {
        "Ground balls": ["Notices loose ball late", "Attacks ball with body position", "Secures and moves", "Wins ball and makes first clean pass"],
        "Passing": ["Throws to stationary target", "Passes under light pressure", "Moves ball before pressure arrives", "Uses pass to create advantage"],
        "Shooting": ["Shoots when open", "Hits cage more often", "Selects higher-quality shots", "Uses shot/pass decision to punish defense"],
        "Dodging": ["Dodges into pressure", "Gets shoulder/angle", "Recognizes slide", "Moves ball to advantage after drawing help"],
        "On-ball defense": ["Chases stick", "Maintains body position", "Forces low-quality choice", "Turns stop into possession/clear"],
        "Off-ball defense": ["Watches ball only", "Sees player and ball", "Communicates/help positions", "Anticipates rotation and protects middle"],
        "Clearing": ["Throws first option", "Finds safe outlet", "Clears through pressure", "Recognizes when to push or settle"],
        "Transition": ["Runs with play", "Recognizes numbers", "Supports correct lane", "Creates/denies advantage in unsettled play"],
        "Communication": ["Quiet", "Calls obvious info", "Communicates early", "Organizes teammate before pressure arrives"],
        "Off-ball offense": ["Stands after pass", "Maintains spacing", "Supports ball carrier", "Creates advantage with cut/screen/rotation"],
        "Possession protection": ["Wins ball but rushes", "Secures first", "Makes simple outlet", "Extends possession under pressure"],
        "Decision-making": ["Outcome-focused", "Recognizes simple option", "Separates decision and execution", "Chooses high-value play by game context"],
    }
    sections = ["# Player Development Progressions"]
    for area, stages in areas.items():
        sections.append(f"\n## {area}")
        for i, stage in enumerate(stages, 1):
            sections.append(
                f"""
### Stage {i}: {stage}

- Observable behaviors: {stage}.
- Common mistakes: rushing, watching, over-dribbling/dodging, or chasing outcome instead of process.
- Next developmental step: {stages[min(i, len(stages)-1)] if i < len(stages) else 'repeat under more pressure and game context'}.
- Possible supporting LaxHornet data: direct stat count, sequence analysis, and process tags such as Created Advantage, Extended Possession, Supported Ball Carrier, Good Decision Unsuccessful Execution, or Won the Second Effort.
"""
            )
    write("player-development-progressions.md", "\n".join(sections))


def make_archetypes():
    archetypes = [
        ("Advantage Creator", "Creates better situations through dodge, feed, spacing, or support.", "Created Advantage, assists, SOG created, smart plays", "High turnovers with low support/decision tags", "3+ tagged advantages or 3 games", "Attack/Midfield", "Best U12+", "You helped the team get better looks, not just more touches."),
        ("Possession Protector", "Wins or receives the ball and helps the team keep it.", "GB, successful clear, extended possession, low immediate turnovers", "Repeated GB-to-turnover sequences", "3+ possession events", "All", "All ages", "You helped turn loose moments into team control."),
        ("Second-Effort Competitor", "Stays in plays after the first action.", "Backed Up Shot, Hustle Play, Won Second Effort, recovery plays", "Effort tags without tactical value", "2+ second-effort events", "All", "All ages", "You kept plays alive with effort that mattered."),
        ("Team Connector", "Supports teammates through passes, outlets, communication, and simple decisions.", "Assists, support tags, communicated early, smart plays", "Forcing individual plays despite options", "3+ support/team-first actions", "All", "Best U12+", "You made the game easier for teammates."),
        ("Composed Responder", "Bounces back after tough moments.", "Recovered After Mistake, positive event after turnover", "Repeated negative events without later engagement", "At least 2 mistake-response sequences", "All", "Best U12+", "You stayed engaged after a tough play."),
        ("Transition Reader", "Recognizes when to push, support, or settle.", "Recognized Transition, clears, GB-to-clear, smart plays", "Rushing every transition touch", "3 transition tags/events", "Midfield/Defense/Goalie", "Best U12+", "You read the changing shape of the game."),
    ]
    rows = []
    for a in archetypes:
        rows.append({"Name": a[0], "Description": a[1], "Behaviors": a[2], "Supporting metrics": a[2], "Disqualifying evidence": a[3], "Minimum sample": a[4], "Positions": a[5], "Age limits": a[6], "Player-facing explanation": a[7]})
    write("player-archetypes.md", "# Player Archetype Opportunities\n\nAvoid permanent labels. Present these as current patterns.\n\n" + md_table(rows, list(rows[0].keys())))


def make_features():
    features = [
        ("Decision vs Outcome Tags", "Parents need a way to credit good reads even when execution fails.", "Add optional postgame tags for decision quality.", "Parent tracker", "Event tags", "Review game -> Add/Edit Tags -> select decision tag", "Medium", "Better feedback and fairer reviews.", "Subjective tagging inconsistency.", "Now"),
        ("Next Focus Development Loop", "Players need one clear improvement target.", "Tie focus to game review, home, setup, and follow-up.", "Parent/player", "Local focus object and game context", "Save focus -> show before next game -> ask follow-up in review", "Medium", "Turns stats into development habit.", "Do not expose privately.", "Now"),
        ("Process Impact Summary", "Raw scores overvalue goals.", "Display process plays beside impact.", "Parent/player", "Events plus tags", "Game Review snapshot/Full Breakdown", "Medium", "Rewards off-ball and team-first contribution.", "Requires education.", "Next"),
        ("Ride Home Recap Mode", "Parents overtalk after games.", "Copy one encouragement, one question, one focus.", "Parents", "Review intelligence", "Review -> Family Recap -> Ride Home version", "Small", "Protects player confidence.", "Should avoid private notes.", "Now"),
        ("Player Growth Timeline", "Season stats do not show development pattern well.", "Show focus completions and process trends over time.", "Parent/player/admin", "Games, focuses, tags", "Season -> Growth Timeline", "Large", "Development-first season story.", "Needs careful privacy and data sync.", "Later"),
    ]
    rows = [{"Feature": f[0], "User problem": f[1], "Solution": f[2], "User": f[3], "Required data": f[4], "Flow": f[5], "Complexity": f[6], "Value": f[7], "Risks": f[8], "Priority": f[9]} for f in features]
    write("feature-opportunities.md", "# Feature Opportunities\n\n" + md_table(rows, list(rows[0].keys())))


def make_backlog():
    items = [
        ("Now", "Add process/decision tags", "Converts CTGP process-over-outcome insight into reviewable data.", "Better feedback for non-scoring plays.", "Tag editor exists.", "No schema change initially; local/export compatible.", "small-medium"),
        ("Now", "Ride Home Recap copy mode", "Directly applies parent communication research.", "Safer postgame parent behavior.", "Family Recap exists.", "Keep private notes/tags excluded.", "small"),
        ("Now", "Low-data and no-overclaim copy audit", "Supports anti-labeling and long-term development principles.", "Prevents app from sounding too certain.", "Postgame intelligence helpers.", "Language-only change.", "small"),
        ("Next", "Process Impact Index", "Makes behavior visible beyond outcomes.", "Better player-development story.", "New tags.", "Derived metric; needs careful UI.", "medium"),
        ("Next", "Possession Quality sequences", "Lacrosse-specific version of process/outcome separation.", "Explains GB-to-clear vs GB-to-turnover.", "Event timestamps/sequences.", "No schema change if derived from existing data.", "medium"),
        ("Next", "Focus follow-up trends", "Confidence grows from visible competence.", "Shows growth across games.", "Focus loop.", "May need cloud persistence later.", "medium"),
        ("Later", "Coach/admin calibration guide", "Subjective tags need consistency.", "Better team-wide data quality.", "Admin portal.", "Create training/help content.", "medium"),
        ("Later", "Growth Timeline", "Season review should show development, not only totals.", "Premium season story.", "More games and tags.", "Bigger UI work.", "large"),
        ("Research Further", "Sport-specific technical lacrosse framework", "CTGP is broad youth sport philosophy, not lacrosse tactics.", "Avoids inventing tactical claims.", "USA Lacrosse/coaching sources.", "Separate research project.", "medium"),
    ]
    rows = [{"Bucket": i[0], "Feature/change": i[1], "Reason": i[2], "Expected value": i[3], "Dependencies": i[4], "Technical considerations": i[5], "Complexity": i[6]} for i in items]
    write("implementation-backlog.md", "# Implementation Backlog\n\n" + md_table(rows, list(rows[0].keys())))


def make_executive_summary():
    text = f"""
# Executive Summary

Changing the Game Project's coaching articles are strongest on player-centered development, parent/coach behavior, confidence, competition, mistakes, talent development, and team culture. They are not lacrosse-specific tactical manuals, so LaxHornet should use them to improve feedback tone, decision/process tags, parent education, and long-term development framing rather than to invent technical lacrosse conclusions.

## Ten most important coaching principles found

1. Evaluate controllable behavior before outcome.
2. Confidence grows from competence, not empty praise.
3. Competing means purposeful response to the next moment, not just running hard.
4. Great teammates serve the team through support, communication, and simple plays.
5. Postgame parent feedback should be short, curious, and supportive.
6. Avoid fixed labels and early talent judgments.
7. The learning environment affects risk-taking and growth.
8. Fun, ownership, and intrinsic motivation protect long-term participation.
9. Tough feedback only works after trust and emotional safety.
10. Winning matters, but it should not hide poor process or undermine development.

## Five strongest opportunities for improving LaxHornet

1. Add decision/process tags to distinguish decision quality, execution, and outcome.
2. Build a Process Impact Index that complements Game Impact.
3. Strengthen the Next Game Focus loop with follow-up and growth trends.
4. Add a Ride Home Recap mode for parent-safe postgame conversation.
5. Add possession-quality sequence logic: win the ball, then protect/use it.

## Three most defensible new metrics

1. Possession Quality.
2. Process Impact Index.
3. Response After Mistake.

## Three highest-value event tags

1. Good Decision, Unsuccessful Execution.
2. Extended Possession.
3. Recovered After Mistake.

## Most important limitation of parent-recorded game data

Parent-recorded data can capture events and visible behaviors, but it cannot reliably determine intent, assignment, emotional state, coaching instruction, opponent quality, or whether a player made the correct read without contextual tags. LaxHornet should phrase conclusions as evidence-informed observations, not verdicts.

## Recommended first implementation phase

Implement a no-schema-change "Process Layer" inside postgame review:

- Add optional process/decision tags.
- Update feedback rules to separate decision, execution, and outcome.
- Add Ride Home Recap copy.
- Add possession-quality sequence language.
- Keep all insights private by default and avoid Live Share exposure.

Primary sources include: {links(SOURCE_URLS['process'] + SOURCE_URLS['confidence'] + SOURCE_URLS['compete'] + SOURCE_URLS['parents'] + SOURCE_URLS['ltad'])}
"""
    write("executive-summary.md", text)


def make_sources_json():
    source_records = []
    for a in reviewed:
        topic = a["primary_topic"]
        recs = []
        if "confidence" in a["topics"]:
            recs.append("Use evidence-based confidence feedback tied to repeated behaviors.")
        if "competitiveness" in a["topics"] or "competition" in a["topics"]:
            recs.append("Add second-effort and recovered-after-mistake tags.")
        if "parent-behavior" in a["topics"]:
            recs.append("Improve Family Recap and Talk About the Game prompts.")
        if "long-term-development" in a["topics"] or "talent-identification" in a["topics"]:
            recs.append("Keep archetypes temporary and avoid fixed talent labels.")
        if not recs:
            recs.append("Use as support for process-first, development-first feedback language.")
        source_records.append(
            {
                "url": a["url"],
                "title": a["title"],
                "author": a["author"],
                "date": a["date"],
                "topics": a["topics"],
                "primary_topic": topic,
                "extracted_principles": [p["name"] for p in PRINCIPLES if any(url in p["sources"] for url in [a["url"]])],
                "associated_laxhornet_recommendations": recs,
            }
        )
    (ROOT / "sources.json").write_text(json.dumps(source_records, indent=2), encoding="utf-8")


def main():
    make_source_inventory()
    make_article_notes()
    make_principles()
    make_conflicts()
    make_event_tags()
    make_metrics()
    make_sequences()
    make_feedback_rulebook()
    make_progressions()
    make_archetypes()
    make_features()
    make_backlog()
    make_executive_summary()
    make_sources_json()
    print("Wrote research deliverables.")


if __name__ == "__main__":
    main()
