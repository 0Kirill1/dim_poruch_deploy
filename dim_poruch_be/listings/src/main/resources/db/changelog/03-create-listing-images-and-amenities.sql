-- liquibase formatted sql
-- changeset kirill:03-create-listing-images-and-amenities
-- comment: Create listing images and amenities tables

CREATE TABLE IF NOT EXISTS listing_images (
    id UUID PRIMARY KEY,
    listing_id UUID NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_listing_images FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_listing_images_listing_id ON listing_images(listing_id);

CREATE TABLE IF NOT EXISTS listing_amenities (
    listing_id UUID NOT NULL,
    amenity VARCHAR(50) NOT NULL,
    PRIMARY KEY (listing_id, amenity),
    CONSTRAINT fk_listing_amenities FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_listing_amenities_listing_id ON listing_amenities(listing_id);
