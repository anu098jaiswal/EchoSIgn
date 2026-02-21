# ISL Video Clips

Drop `.mp4` sign language video clips here. Filename must match the gloss name exactly.

## Naming Convention

| Gloss triggered by speech | Filename needed |
|--------------------------|-----------------|
| goodbye, bye, farewell   | `goodbye.mp4`   |
| thanks, thank, grateful  | `thank_you.mp4` |
| sorry, apologize         | `sorry.mp4`     |
| please                   | `please.mp4`    |
| bad, terrible            | `bad.mp4`       |
| want, wish               | `want.mp4`      |
| need, require            | `need.mp4`      |
| like, enjoy              | `like.mp4`      |
| love, care               | `love.mp4`      |
| feel, emotion            | `feel.mp4`      |
| know, knowledge          | `know.mp4`      |
| learn, study, student    | `learn.mp4`     |
| teach, explain, teacher  | `teach.mp4`     |
| help, support            | `help.mp4`      |
| work, make, build        | `work.mp4`      |
| stop, wait, hold         | `stop.mp4`      |
| go, move, walk           | `go.mp4`        |
| come, arrive             | `come.mp4`      |
| eat, food, hungry        | `eat.mp4`       |
| drink, juice, thirsty    | `drink.mp4`     |
| water                    | `water.mp4`     |
| more, again, another     | `more.mp4`      |
| finish, done, complete   | `finish.mp4`    |
| question, ask, why, how  | `question.mp4`  |

## Free ISL Source — INCLUDE Dataset (IIT Bombay)

263 ISL signs recorded by native signers, free for research use.

GitHub: https://github.com/iitbmada/INCLUDE

Steps:
1. Clone/download the repo
2. Find the clip for each sign in the dataset
3. Rename to match filenames above (lowercase + underscore)
4. Drop here — extension picks them up on next reload

## How It Works

- If this folder has `love.mp4` → saying "love" plays the ISL video full-screen
- If the file is missing → Kaya stands idle for 600ms then moves to next word
- Kaya (3D avatar) handles: hello, yes, no, good, think, point, clap, understand
- Everything else: video clip (if present) or fingerspelling fallback
