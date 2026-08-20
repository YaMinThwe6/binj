# BINJ 🎬

BINJ is a social movie platform designed to help people discover movies, connect with people who share their interests, and turn watching movies into a shared social experience.

## 🎯 Vision

Instead of simply asking:

> "What movie should I watch?"

BINJ aims to answer:

> **"I want to watch this movie. Who else wants to watch it with me?"**

The platform combines movie discovery, personalized recommendations, social connections, watch events, location-based discovery, and movie communities.

## ✨ Planned Features

### 🎬 Movie Discovery
- Search movies and series
- Movie information
- Ratings and likes
- Reviews
- Genres
- Languages
- Regions
- Watched list
- Watchlist
- Personalized recommendations

### 📺 Streaming Availability
- Find which streaming platforms have a movie available
- Explore where a movie can be watched

### 👤 User Profiles
- Movie preferences and activity
- Watched movies
- Watchlist
- Ratings and reviews
- Social connections
- Privacy and security preferences

### 👥 People Discovery
- See people who watched a particular movie
- Discover people with similar movie tastes
- Use shared movie interests as a basis for social connections

### 🎟️ Events & Watch Parties
- Create public or private events
- Online or in-person events
- Recurring events
- Find people interested in watching the same movie

### 💻 Watch Together
- Future support for synchronized movie watching
- Teleparty-style viewing experience

### 💬 Persistent Movie Rooms
- Movie-specific chat rooms
- Discuss a movie before watching
- Interact while watching
- Continue discussions after the movie ends

### 🗺️ Location-Based Discovery
Discover movies, people, and events based on:
- Movie
- Director
- Genre
- Location
- Time
- Virtual / in-person
- Nearby events

### 🧵 Communities & Forums
- User-created communities
- Subreddit-style discussions
- Community moderators
- Topic-specific movie communities

## 🧠 Recommendation & Social Discovery

BINJ aims to combine movie metadata with user-generated activity to create meaningful recommendations and social discovery.

For example:

> "People with similar movie tastes watched these movies."

or:

> "4 people near you are interested in watching this movie tonight."

The long-term goal is to build a relationship between the **movie graph** and the **social graph**.

## 📊 Data

The initial prototype will explore the **IMDb dataset available through Google BigQuery** as the movie-data foundation.

IMDb data will potentially provide information such as movie metadata, genres, ratings, people, and relationships between movies and contributors.

BINJ will generate its own application data, including:

- User profiles
- Watch history
- Watchlists
- Likes
- Ratings
- Reviews
- Events
- Social connections
- Discussions
- User preferences

The IMDb dataset will first be audited to determine exactly which BINJ features it can support and what additional or synthetic data may be required.

## ☁️ Technology

The project is being developed as part of **Pachamama 2026** with a focus on Google technologies and data-driven functionality.

Potential technologies include:

- Google Cloud
- BigQuery
- Gemini / Google AI Studio
- Firebase / Firestore
- Cloud Run
- Google Cloud analytics and data services

The final technology stack will be determined after the data feasibility analysis and MVP scope are finalized.

## 🚧 Project Status

BINJ is currently in the **prototype/build phase**.

### Current priorities

1. Analyze the IMDb dataset
2. Determine whether the available data supports the planned features
3. Identify missing data requirements
4. Define the MVP
5. Design the data architecture
6. Build the prototype
7. Demonstrate the recommendation and social-discovery capabilities

## 🏆 Pachamama 2026

BINJ is being developed as an entry for **Pachamama 2026**, a Google innovation challenge focused on building real-world, data-driven solutions using Google technologies.

---

**BINJ — Find your movie. Find your people. 🍿**
