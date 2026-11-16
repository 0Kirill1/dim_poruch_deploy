-- liquibase formatted sql
-- changeset kirill:01-create-booking-table
-- comment: Create booking table

CREATE TABLE IF NOT EXISTS booking(
    id UUID PRIMARY KEY,
    listing_id UUID,
    tenant_id UUID,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_booking_dates ON booking(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_booking_status ON booking(status);