# Trending Component task (Backend)

## Methods in play

- `/get-visits`

  Get the list of all the Visit IDs present in the database. Used in populating the options of `<select>` component.
  
- `/get-articles`

  Get the list of all the Article IDs present in the database. Used in populating the options of `<select>` component.
  
- `/modify-behaviour?isJob=<?>` or  `/modify-behaviour?visit_id=<?>&article_id=<?>`

  Simulate the user activity of opening another article.
  - If *isJob* is set to one, then a bulk of users' activity is modified
  - Else user with visit ID as *visit_id* have their article ID set as *article_id*

- `/fetch-trending?visit_id=<?>&article_id=<?>`
  
  Our main act. Based on article_id's category and user's geolocation, get the list of trending articles, sorted in decreasing viewership. Factors considered for "trendiness":
  - Get latest user activity of past 2 minutes
  - Filter out those articles whose publishing date is greater than 5 days
  - Filter out those articles whose category doesn't match our current article's category *
  - Filter out those users whose region doesn't match our current user's region *

## FAQs

Q: I have selected both article and visit ID and hit on submit, yet there has been no rendering for 5 seconds?

A: As I have not scheduled a job for mimicking user traffic, you might have to call `/modify-behaviour?isJob=1` to get the populating stuff sorted. 
