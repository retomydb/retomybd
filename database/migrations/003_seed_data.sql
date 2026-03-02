-- =============================================================================
-- retomY — Enterprise Dataset Marketplace
-- Migration 003: Seed Data (Categories + Demo Data)
-- =============================================================================

-- =============================================================================
-- SEED CATEGORIES
-- =============================================================================

INSERT INTO retomy.Categories (Name, Slug, Description, SortOrder) VALUES
('AI & Machine Learning', 'ai-ml', 'Training datasets, model weights, NLP corpora, computer vision data', 1),
('Finance & Economics', 'finance', 'Market data, trading signals, economic indicators, crypto datasets', 2),
('Healthcare & Life Sciences', 'healthcare', 'Clinical trials, genomics, medical imaging, drug discovery data', 3),
('Gaming & Entertainment', 'gaming', 'Game analytics, player behavior, in-game economies, esports stats', 4),
('Geospatial & Maps', 'geospatial', 'Satellite imagery, GPS traces, urban planning, weather data', 5),
('Government & Public Data', 'government', 'Census, regulatory filings, public records, open government', 6),
('Social Media & Web', 'social-media', 'Social network graphs, sentiment data, web scraping datasets', 7),
('E-Commerce & Retail', 'ecommerce', 'Product catalogs, purchase history, pricing data, reviews', 8),
('Science & Research', 'science', 'Academic datasets, experiment results, physics, chemistry, biology', 9),
('Sports & Fitness', 'sports', 'Player statistics, match results, fitness tracking, fantasy sports', 10),
('Transportation & Logistics', 'transportation', 'Traffic patterns, fleet data, shipping, supply chain', 11),
('Energy & Environment', 'energy', 'Power grid, renewable energy, pollution, climate datasets', 12),
('Real Estate & Property', 'real-estate', 'Property listings, valuations, demographics, zoning data', 13),
('Text & NLP', 'text-nlp', 'Corpora, sentiment analysis, translation pairs, embeddings', 14),
('Image & Video', 'image-video', 'Labeled images, video annotations, object detection, OCR', 15),
('Audio & Speech', 'audio-speech', 'Speech recognition, music analysis, voice datasets', 16);
GO

PRINT 'Migration 003 completed - Seed data inserted.';
GO
