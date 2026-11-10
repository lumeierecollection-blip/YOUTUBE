# Why do some AI models fail at counting letters, and what fixes it?

> not reviewed by the engine critic. written directly on the owner's instruction from fetched sources.

1. Why do some AI models fail at counting letters?  
   claims: none
2. We asked two models twenty questions, once plainly, once spelling it out first.  
   claims: design
3. A real reply: it spells the word, then counts.  
   claims: design
4. Asked plainly, Google's Flash-Lite got sixteen right.  
   claims: plain
5. Spelling first, twenty.  
   claims: spelled
6. On random letters, six of ten became ten.  
   claims: split
7. OpenAI's GPT-OSS was perfect either way.  
   claims: other0
8. Why: models read tokens, not letters.  
   claims: tokenize
9. Strawberry is one token, but ten letters.  
   claims: tokens
10. Same models, same questions, one change.  
   claims: design
11. So make the model spell it out first.  
   claims: none

## Sources
- https://github.com/lumeierecollection-blip/YOUTUBE/actions/runs/42865178238
- https://en.wikipedia.org/wiki/Large_language_model
