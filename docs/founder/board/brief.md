# Board brief: MaestrIA

(Stand-alone brief. The board cannot see any other conversation.)

## The idea
MaestrIA is a web app in Spanish (Argentina) for private tutors ("profes particulares"). The tutor uploads the official syllabus of a subject as a PDF; the app extracts units and topics and generates practice quizzes per topic (1 to 50 questions, AI-reviewed). The tutor sends the student a WhatsApp link; the student practises without creating an account. If stuck, the student gets a hint, never the answer; if wrong, an explanation of what they confused. The tutor sees a per-student sheet: which topics are weak, so the next paid class targets them. Tagline: "Tu alumno llega a la mesa sabiendo qué le falta" (your student arrives at the exam knowing what they are missing). There is also an "Aula" mode for whole school courses, and export to Moodle.

## Who pays
- Main: independent private tutors in Argentina (maths first; secondary school, tertiary/teacher-training institutes, university entrance), 3 to 20 students each, charging ARS 15,000–20,000 per class (≈ USD 8–10). Strong seasonality: make-up exams in December and February/March, entrance courses.
- Secondary: tutoring centres with 4–8 tutors; school teachers with ~35-student courses; adult self-learners (hypothesis).

## Price (ARS; USD 1 ≈ ARS 1,950)
- Free forever: 2 private students + 1 course, 10 quizzes per 30 days.
- Particular: ARS 20,000/month per block of 5 students (≈ the price of one private class), or a 90-day pass at ARS 50,000.
- Aula: ARS 15,000/month per course (+ ARS 10,000 per extra course). Institution: custom (reference cap ARS 99,000).
- Early "Fundadora" tutor: ARS 10,000 for 1 block.
- Paid with Mercado Pago links; manual activation for now.

## Costs and team
- Solo founder: a maths teacher at tertiary level who is also an AI engineer; built the product himself; ~2 hours/day for sales and support.
- Measured AI cost in production: ≈ USD 0.005 per generated quiz, USD 0.0004 per graded answer, USD 0.0002 per hint. Hosting ≈ USD 20/month, database free tier.
- Usage so far: dozens of users in testing; 7 active users last week; no paying customers yet.

## Go-to-market
Meta ads to teachers across Argentina (prepared, ARS 2,000/day, not launched), organic Instagram, the founder's own network, and the founder's own private students as the first case study (December exams). Goal: ~20 paying tutors by February 2027.

## Known facts and open questions
- Competitors and substitutes: general chatbots (ChatGPT, Gemini), homework solvers (Photomath, Gauth, Brainly), quiz tools (Wayground/Quizizz, Kahoot, Google Forms, Moodle), and tutors' own PDFs + WhatsApp. Prices not yet researched.
- Unknown: how many private tutors in Argentina would pay; cost to acquire one; churn after exam season.
