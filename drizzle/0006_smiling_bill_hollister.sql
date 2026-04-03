ALTER TABLE `posts` ADD `isCarousel` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `carouselSlides` json;