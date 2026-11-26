CREATE TABLE "attempt_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"snapshot_question_key" text NOT NULL,
	"source_question_id" uuid,
	"response" jsonb NOT NULL,
	"awarded_points" numeric NOT NULL,
	"max_points" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"student_name" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"score" numeric NOT NULL,
	"max_score" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" text NOT NULL,
	"type" text NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb NOT NULL,
	"answer_key" jsonb NOT NULL,
	"points" numeric DEFAULT 1 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_type_check" CHECK ("questions"."type" in ('multiple_choice', 'multiple_answer', 'true_false', 'short_answer'))
);
--> statement-breakpoint
CREATE TABLE "test_questions" (
	"test_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "test_questions_test_id_question_id_pk" PRIMARY KEY("test_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "test_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"share_token" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tests_status_check" CHECK ("tests"."status" in ('draft', 'published', 'closed'))
);
--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_source_question_id_questions_id_fk" FOREIGN KEY ("source_question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_snapshot_id_test_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."test_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_snapshots" ADD CONSTRAINT "test_snapshots_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempt_answers_attempt_id_idx" ON "attempt_answers" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "attempt_answers_source_question_id_idx" ON "attempt_answers" USING btree ("source_question_id");--> statement-breakpoint
CREATE INDEX "attempts_test_id_idx" ON "attempts" USING btree ("test_id");--> statement-breakpoint
CREATE INDEX "attempts_snapshot_id_idx" ON "attempts" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "questions_teacher_id_idx" ON "questions" USING btree ("teacher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "test_snapshots_test_id_idx" ON "test_snapshots" USING btree ("test_id");--> statement-breakpoint
CREATE INDEX "tests_teacher_id_idx" ON "tests" USING btree ("teacher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tests_share_token_idx" ON "tests" USING btree ("share_token");