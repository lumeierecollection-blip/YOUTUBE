# Cutouts that could not be fetched

Each of these failed three different queries (the attempts are logged in
`data/cutout-library-log.jsonl`). A missing cutout is NOT replaced by a drawing:
the beat draws no concept visual for it (the number and label alone), or a
cutout of the same category when one exists. Re-run
`node scripts/build-cutout-library.mjs --only <name>` after adding a key or a
query.

## bank-building

- pixabay "bank building isolated": rejected — the mask runs along the photo's left edge for 59% of it (> 40%): cut by the frame
- pixabay "bank building isolated": verify CLOSE — saw "a modern skyscraper"
- pixabay "bank building isolated": rejected — the object covers 2.0% of the photo (< 12%)
- pixabay "bank building isolated": verify CLOSE — saw "a modern skyscraper"
- pixabay "bank building isolated": rejected — the mask runs along the photo's left edge for 42% of it (> 40%): cut by the frame
- pixabay "bank building isolated": verify CLOSE — saw "a modern skyscraper"

## bank-statement

- pixabay "bank statement isolated": rejected — the mask runs along the photo's bottom edge for 87% of it (> 40%): cut by the frame
- pixabay "bank statement isolated": verify WRONG — saw "a skyscraper"
- pixabay "bank statement isolated": verify WRONG — saw "a modern bank building"
- pixabay "bank statement isolated": rejected — the object covers 0.0% of the photo (< 12%)
- pixabay "bank statement isolated": verify WRONG — saw "a stack of pancakes"

## broken-chain

- pixabay "broken chain isolated": rejected — the object covers 0.1% of the photo (< 12%)
- pixabay "broken chain isolated": rejected — the mask fills 99% of its bounding box (> 92%): a rectangle, not an object
- pixabay "broken chain isolated": rejected — the object covers 4.8% of the photo (< 12%)
- pixabay "broken chain isolated": verify NONE — saw "no vision provider answered"
- pixabay "broken chain isolated": rejected — the object covers 6.5% of the photo (< 12%)
- pixabay "broken chain isolated": rejected — the object covers 3.5% of the photo (< 12%)
- pixabay "broken chain": rejected — the object covers 0.1% of the photo (< 12%)
- pixabay "broken chain": verify WRONG — saw "a rusty excavator"
- pixabay "broken chain": rejected — the mask fills 99% of its bounding box (> 92%): a rectangle, not an object
- pixabay "broken chain": verify NONE — saw "no vision provider answered"

## calendar

- pixabay "calendar isolated": rejected — the object covers 0.0% of the photo (< 12%)
- pixabay "calendar isolated": verify NONE — saw "no vision provider answered"
- pixabay "calendar isolated": verify NONE — saw "no vision provider answered"
- pixabay "calendar isolated": verify NONE — saw "no vision provider answered"

## checkmark

- pixabay "checkmark isolated": 30 candidate(s), none passed the licence / keyword / size filter
- pixabay "checkmark": rejected — the object covers 10.9% of the photo (< 12%)
- pixabay "check mark isolated": verify WRONG — saw "a hand holding a marker"
- pixabay "check mark isolated": verify CLOSE — saw "a 3D character holding a giant checkmark"
- pixabay "check mark isolated": rejected — the mask runs along the photo's bottom edge for 100% of it (> 40%): cut by the frame
- pixabay "check mark isolated": verify WRONG — saw "a horse head"

## contract

- pixabay "contract isolated": rejected — the mask runs along the photo's right edge for 72% of it (> 40%): cut by the frame
- pixabay "contract isolated": verify WRONG — saw "a woman sitting in a chair reading a blue folder"
- pixabay "contract isolated": verify WRONG — saw "a woman writing on a clipboard"
- pixabay "contract isolated": rejected — the object covers 0.0% of the photo (< 12%)
- pixabay "contract isolated": verify CLOSE — saw "a wax seal stamp"

## courthouse

- pixabay "courthouse isolated": rejected — the object covers 0.1% of the photo (< 12%)
- pixabay "courthouse isolated": rejected — the mask runs along the photo's bottom edge for 100% of it (> 90%): cut by the frame
- pixabay "courthouse isolated": verify CLOSE — saw "modern office building"
- pixabay "courthouse isolated": verify CLOSE — saw "a brick building"
- pixabay "courthouse isolated": verify CLOSE — saw "a clock tower and clock"

## credit-card

- pixabay "credit card isolated": rejected — the mask runs along the photo's bottom edge for 60% of it (> 40%): cut by the frame
- pixabay "credit card isolated": rejected — the largest solid region is 53% of what is visible (< 80%): more than one object / a scene
- pixabay "credit card isolated": verify WRONG — saw "a floral wreath"
- pixabay "credit card isolated": verify WRONG — saw "pink flowers on branches"
- pixabay "credit card isolated": verify WRONG — saw "a pink rose with stem and leaves"

## crosshair

- pixabay "crosshair isolated": 30 candidate(s), none passed the licence / keyword / size filter
- pixabay "crosshair": 0 candidate(s), none passed the licence / keyword / size filter
- pixabay "target crosshair isolated": rejected — the object covers 6.2% of the photo (< 12%)
- pixabay "target crosshair isolated": verify NONE — saw "no vision provider answered"
- pixabay "target crosshair isolated": rejected — the object covers 1.5% of the photo (< 12%)
- pixabay "target crosshair isolated": rejected — the object covers 2.4% of the photo (< 12%)
- pixabay "target crosshair isolated": verify WRONG — saw "a hand holding a digital camera"
- pixabay "target crosshair isolated": verify NONE — saw "no vision provider answered"

## dollar-sign

- pixabay "dollar sign isolated": verify WRONG — saw "a man wearing a checkered headscarf and green sunglasses"
- pixabay "dollar sign isolated": verify WRONG — saw "a black glove making a peace sign"
- pixabay "dollar sign isolated": verify WRONG — saw "a hand making a peace sign"

## downward-arrow

- pixabay "downward arrow isolated": rejected — the object covers 10.0% of the photo (< 12%)
- pixabay "downward arrow isolated": rejected — the object covers 2.5% of the photo (< 12%)
- pixabay "downward arrow isolated": rejected — the object covers 6.8% of the photo (< 12%)
- pixabay "downward arrow isolated": rejected — the largest solid region is 65% of what is visible (< 80%): more than one object / a scene
- pixabay "downward arrow isolated": rejected — the object covers 0.5% of the photo (< 12%)
- pixabay "downward arrow isolated": verify WRONG — saw "upward arrow sign"
- pixabay "downward arrow": rejected — the object covers 10.0% of the photo (< 12%)
- pixabay "downward arrow": verify WRONG — saw "a wooden post with upward-pointing arrow signs"
- pixabay "downward arrow": rejected — the object covers 2.5% of the photo (< 12%)
- pixabay "downward arrow": verify WRONG — saw "an archer"

## evidence-tag

- pixabay "evidence tag isolated": verify WRONG — saw "a bird with long legs"
- pixabay "evidence tag isolated": verify WRONG — saw "a jar of orange marmalade with a label"
- pixabay "evidence tag isolated": rejected — the mask runs along the photo's left edge for 41% of it (> 40%): cut by the frame
- pixabay "evidence tag isolated": verify WRONG — saw "graffiti on a wheelie bin"

## flag-america

- pixabay "american flag isolated": rejected — the object covers 7.0% of the photo (< 12%)
- pixabay "american flag isolated": rejected — the mask runs along the photo's left edge for 53% of it (> 40%): cut by the frame
- pixabay "american flag isolated": rejected — opaque pixels touch all four edges: the object is cropped, not isolated
- pixabay "american flag isolated": verify CLOSE — saw "a soldier kneeling next to an American flag"
- pixabay "american flag isolated": verify NONE — saw "no vision provider answered"
- pixabay "american flag isolated": verify NONE — saw "no vision provider answered"

## gavel

- pixabay "gavel isolated": verify NONE — saw "no vision provider answered"
- pixabay "gavel isolated": rejected — the object covers 7.4% of the photo (< 12%)
- pixabay "gavel": verify WRONG — saw "a collection of cryptocurrency coins"
- pixabay "gavel": verify WRONG — saw "a stack of metal coins"

## globe

- pixabay "globe isolated": verify NONE — saw "no vision provider answered"
- pixabay "globe isolated": verify NONE — saw "no vision provider answered"
- pixabay "globe isolated": verify NONE — saw "no vision provider answered"

## key

- pixabay "door key isolated": verify NONE — saw "no vision provider answered"
- pixabay "door key isolated": rejected — the object covers 2.2% of the photo (< 12%)
- pixabay "door key isolated": rejected — the object covers 5.5% of the photo (< 12%)
- pixabay "door key isolated": verify NONE — saw "no vision provider answered"
- pixabay "door key isolated": rejected — the object covers 9.8% of the photo (< 12%)
- pixabay "door key isolated": rejected — the object covers 2.4% of the photo (< 12%)
- pixabay "door key": verify WRONG — saw "a metal door knocker"

## magnifying-glass

- pixabay "magnifying glass isolated": rejected — the mask runs along the photo's bottom edge for 41% of it (> 40%): cut by the frame
- pixabay "magnifying glass isolated": rejected — the largest solid region is 74% of what is visible (< 80%): more than one object / a scene
- pixabay "magnifying glass isolated": verify WRONG — saw "a hand holding a crystal ball"
- pixabay "magnifying glass isolated": verify NONE — saw "no vision provider answered"
- pixabay "magnifying glass isolated": verify NONE — saw "no vision provider answered"

## map-pin

- pixabay "map pin isolated": rejected — the object covers 1.6% of the photo (< 12%)
- pixabay "map pin isolated": rejected — the object covers 0.6% of the photo (< 12%)
- pixabay "map pin isolated": verify WRONG — saw "a woman holding a megaphone"
- pixabay "map pin isolated": rejected — the largest solid region is 72% of what is visible (< 80%): more than one object / a scene
- pixabay "map pin isolated": verify NONE — saw "no vision provider answered"
- pixabay "map pin isolated": rejected — the object covers 6.1% of the photo (< 12%)
- pixabay "map pin": rejected — the object covers 1.6% of the photo (< 12%)
- pixabay "map pin": rejected — the object covers 0.6% of the photo (< 12%)
- pixabay "map pin": verify WRONG — saw "a woman holding a megaphone"

## person-walking

- pixabay "person walking isolated": verify WRONG — saw "a pair of legs wearing sneakers"
- pixabay "person walking isolated": rejected — the object covers 1.9% of the photo (< 12%)
- pixabay "person walking isolated": rejected — the object covers 2.0% of the photo (< 12%)
- pixabay "person walking isolated": rejected — the object covers 4.8% of the photo (< 12%)
- pixabay "person walking isolated": rejected — the object covers 7.6% of the photo (< 12%)
- pixabay "person walking isolated": verify CLOSE — saw "a pedestrian crossing sign with a convict"
- pixabay "person walking": verify WRONG — saw "a pair of legs wearing sneakers"

## radar

- pixabay "radar isolated": verify NONE — saw "no vision provider answered"
- pixabay "radar isolated": verify NONE — saw "no vision provider answered"
- pixabay "radar isolated": rejected — the object covers 0.4% of the photo (< 12%)
- pixabay "radar isolated": verify WRONG — saw "an airport control tower"

## scales

- pixabay "scales of justice isolated": rejected — the object covers 3.5% of the photo (< 12%)
- pixabay "scales of justice isolated": verify CLOSE — saw "statue of Lady Justice"
- pixabay "scales of justice isolated": rejected — the object covers 12.0% of the photo (< 12%)
- pixabay "scales of justice isolated": rejected — the object covers 8.2% of the photo (< 12%)
- pixabay "scales of justice isolated": rejected — the object covers 8.7% of the photo (< 12%)
- pixabay "scales of justice isolated": verify WRONG — saw "a golden statue of Lady Justice"
- pixabay "scales of justice": rejected — the object covers 3.5% of the photo (< 12%)
- pixabay "scales of justice": verify CLOSE — saw "statue of Lady Justice"

## scientist

- pixabay "scientist isolated": verify CLOSE — saw "a statue of a man"
- pixabay "scientist isolated": verify WRONG — saw "a space rocket"
- pixabay "scientist isolated": verify CLOSE — saw "gloved hand holding a test tube with a pipette"

## shield

- pixabay "shield isolated": rejected — the object covers 0.0% of the photo (< 12%)
- pixabay "shield isolated": rejected — the mask runs along the photo's right edge for 62% of it (> 40%): cut by the frame
- pixabay "shield isolated": verify NONE — saw "no vision provider answered"
- pixabay "shield isolated": rejected — the object covers 9.7% of the photo (< 12%)
- pixabay "shield isolated": rejected — the largest solid region is 68% of what is visible (< 80%): more than one object / a scene
- pixabay "shield isolated": rejected — the mask fills 93% of its bounding box (> 92%): a rectangle, not an object
- pixabay "shield": rejected — the object covers 0.0% of the photo (< 12%)
- pixabay "shield": verify WRONG — saw "a stone wall with a painted emblem"
- pixabay "shield": rejected — the mask runs along the photo's right edge for 62% of it (> 40%): cut by the frame
- pixabay "shield": verify NONE — saw "no vision provider answered"

## stamp-approved

- pixabay "approved stamp isolated": rejected — the largest solid region is 46% of what is visible (< 80%): more than one object / a scene
- pixabay "approved stamp isolated": verify WRONG — saw "envelopes with stamps"
- pixabay "approved stamp isolated": rejected — the mask fills 93% of its bounding box (> 92%): a rectangle, not an object
- pixabay "approved stamp isolated": rejected — the mask fills 93% of its bounding box (> 92%): a rectangle, not an object
- pixabay "approved stamp isolated": rejected — the mask fills 92% of its bounding box (> 92%): a rectangle, not an object
- pixabay "approved stamp isolated": rejected — only 10% of the cropped result is transparent (< 12%)
- pixabay "approved stamp": rejected — the largest solid region is 46% of what is visible (< 80%): more than one object / a scene
- pixabay "approved stamp": verify WRONG — saw "envelopes with stamps"
- pixabay "approved stamp": rejected — the object covers 2.6% of the photo (< 12%)
- pixabay "approved stamp": verify WRONG — saw "a white and yellow orchid flower"

## wallet

- pixabay "wallet isolated": verify WRONG — saw "a framed poster with German text"
- pixabay "wallet isolated": verify CLOSE — saw "a gift box with various items including a cardholder"
- pixabay "wallet isolated": rejected — the mask runs along the photo's bottom edge for 58% of it (> 40%): cut by the frame
- pixabay "wallet isolated": rejected — the mask runs along the photo's bottom edge for 46% of it (> 40%): cut by the frame
- pixabay "wallet isolated": verify WRONG — saw "a brown hat and sunglasses"
