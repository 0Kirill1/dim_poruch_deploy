-- liquibase formatted sql
-- changeset kirill:02-add-review-reply
-- comment: Add reply and replied_at columns to reviews

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reply TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP WITH TIME ZONE;
