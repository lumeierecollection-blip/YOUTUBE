# Cutouts that could not be fetched

Each of these failed three different queries (the attempts are logged in
`data/cutout-library-log.jsonl`). A missing cutout is NOT replaced by a drawing:
the beat draws no concept visual for it (the number and label alone), or a
cutout of the same category when one exists. Re-run
`node scripts/build-cutout-library.mjs --only <name>` after adding a key or a
query.

## bank-statement

- pixabay "bank statement isolated": verify WRONG — saw "a wooden bench"
- pixabay "bank statement isolated": verify WRONG — saw "a stone statue of children kissing on a bench"
- pixabay "bank statement isolated": rejected — the object covers 11.5% of the photo (< 12%)
- pixabay "bank statement isolated": verify WRONG — saw "a green wooden bench"

## broken-chain

- pixabay "broken chain isolated": rejected — the object covers 7.4% of the photo (< 12%)
- pixabay "broken chain isolated": verify WRONG — saw "a rusty bulldozer"
- pixabay "broken chain isolated": rejected — the object covers 4.8% of the photo (< 12%)
- pixabay "broken chain isolated": rejected — opaque pixels touch all four edges: the object is cropped, not isolated
- pixabay "broken chain isolated": rejected — the mask runs along the photo's top edge for 51% of it (> 40%): cut by the frame
- pixabay "broken chain isolated": rejected — the object covers 6.5% of the photo (< 12%)
- pixabay "broken chain": rejected — the object covers 0.1% of the photo (< 12%)
- pixabay "broken chain": verify WRONG — saw "a rusty excavator"
- pixabay "broken chain": verify WRONG — saw "beaded bracelet in a geode"

## checkmark

- pixabay "checkmark isolated": 30 candidate(s), none passed the licence / keyword / size filter
- pixabay "checkmark": rejected — the object covers 10.9% of the photo (< 12%)
- pixabay "checkmark": rejected — the object covers 8.0% of the photo (< 12%)
- pixabay "checkmark": rejected — the object covers 8.6% of the photo (< 12%)
- pixabay "checkmark": rejected — the object covers 4.9% of the photo (< 12%)
- pixabay "checkmark": verify WRONG — saw "a laptop computer displaying an application form"
- pixabay "check mark isolated": verify WRONG — saw "a hand holding a marker"
- pixabay "check mark isolated": verify CLOSE — saw "a 3D character holding a giant checkmark"

## contract

- pixabay "contract isolated": verify CLOSE — saw "a rolled parchment scroll"
- pixabay "contract isolated": rejected — the mask runs along the photo's right edge for 72% of it (> 40%): cut by the frame
- pixabay "contract isolated": verify CLOSE — saw "two wooden mannequin figures shaking hands"
- pixabay "contract isolated": rejected — the largest solid region is 40% of what is visible (< 80%): more than one object / a scene
- pixabay "contract isolated": rejected — the largest solid region is 65% of what is visible (< 80%): more than one object / a scene
- pixabay "contract isolated": rejected — the object covers 5.0% of the photo (< 12%)
- pixabay "contract": verify CLOSE — saw "a rolled parchment scroll"

## credit-card

- pixabay "credit card isolated": rejected — the largest solid region is 30% of what is visible (< 80%): more than one object / a scene
- pixabay "credit card isolated": rejected — the largest solid region is 49% of what is visible (< 80%): more than one object / a scene
- pixabay "credit card isolated": rejected — the mask runs along the photo's bottom edge for 60% of it (> 40%): cut by the frame
- pixabay "credit card isolated": rejected — the mask runs along the photo's left edge for 57% of it (> 40%): cut by the frame
- pixabay "credit card isolated": verify CLOSE — saw "a pile of credit cards"
- pixabay "credit card isolated": rejected — the largest solid region is 61% of what is visible (< 80%): more than one object / a scene
- pixabay "credit card": rejected — the largest solid region is 30% of what is visible (< 80%): more than one object / a scene
- pixabay "credit card": rejected — the largest solid region is 49% of what is visible (< 80%): more than one object / a scene
- pixabay "credit card": rejected — the mask runs along the photo's left edge for 57% of it (> 40%): cut by the frame
- pixabay "credit card": verify CLOSE — saw "a pile of credit cards"
- pixabay "credit card": rejected — the largest solid region is 61% of what is visible (< 80%): more than one object / a scene
- pixabay "credit card": verify CLOSE — saw "a credit card inserted into a payment terminal"

## crosshair

- pixabay "crosshair isolated": verify WRONG — saw "a gun part or rail"
- pixabay "crosshair isolated": verify WRONG — saw "a person silhouette on a wooden walkway"
- pixabay "crosshair isolated": rejected — the object covers 2.8% of the photo (< 12%)
- pixabay "crosshair": verify CLOSE — saw "a drone viewed through a crosshair scope"

## dollar-sign

- pixabay "dollar sign isolated": verify WRONG — saw "a fan of one-dollar bills"
- pixabay "dollar sign isolated": verify WRONG — saw "one dollar bill"
- pixabay "dollar sign isolated": verify WRONG — saw "a one dollar bill flag"

## downward-arrow

- pixabay "downward arrow isolated": verify WRONG — saw "a maintenance truck with a downward arrow traffic sign"
- pixabay "downward arrow isolated": verify WRONG — saw "an armillary sphere sculpture"
- pixabay "downward arrow isolated": rejected — opaque pixels touch all four edges: the object is cropped, not isolated
- pixabay "downward arrow isolated": verify WRONG — saw "a large historic building"

## evidence-tag

- pixabay "evidence tag isolated": verify WRONG — saw "a metal wristwatch"
- pixabay "evidence tag isolated": rejected — the mask runs along the photo's left edge for 41% of it (> 40%): cut by the frame
- pixabay "evidence tag isolated": rejected — the mask runs along the photo's bottom edge for 45% of it (> 40%): cut by the frame
- pixabay "evidence tag isolated": verify WRONG — saw "a young woman portrait"
- pixabay "evidence tag isolated": verify WRONG — saw "a shoe footprint in sand"

## key

- pixabay "door key isolated": rejected — the object covers 5.5% of the photo (< 12%)
- pixabay "door key isolated": verify CLOSE — saw "a bunch of keys"
- pixabay "door key isolated": verify WRONG — saw "a door handle with a keyhole"
- pixabay "door key isolated": verify WRONG — saw "a metal door handle or latch"

## map-pin

- pixabay "map pin isolated": rejected — the object covers 1.6% of the photo (< 12%)
- pixabay "map pin isolated": rejected — the object covers 0.6% of the photo (< 12%)
- pixabay "map pin isolated": verify WRONG — saw "a woman holding a megaphone"
- pixabay "map pin isolated": rejected — the largest solid region is 72% of what is visible (< 80%): more than one object / a scene
- pixabay "map pin isolated": verify WRONG — saw "a woman in green swimwear holding a balloon and megaphone"
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

## scales

- pixabay "scales of justice isolated": rejected — the object covers 9.1% of the photo (< 12%)
- pixabay "scales of justice isolated": rejected — the object covers 8.9% of the photo (< 12%)
- pixabay "scales of justice": rejected — the object covers 3.5% of the photo (< 12%)
- pixabay "scales of justice": rejected — the largest solid region is 65% of what is visible (< 80%): more than one object / a scene
- pixabay "scales of justice": rejected — the object covers 7.4% of the photo (< 12%)
- pixabay "scales of justice": rejected — the object covers 5.0% of the photo (< 12%)
- pixabay "scales of justice": verify WRONG — saw "a judge's gavel and a wristwatch"
- pixabay "scales of justice": rejected — the mask runs along the photo's bottom edge for 85% of it (> 40%): cut by the frame
- pixabay "justice scale isolated": rejected — the object covers 3.5% of the photo (< 12%)
- pixabay "justice scale isolated": rejected — the mask runs along the photo's bottom edge for 85% of it (> 40%): cut by the frame
- pixabay "justice scale isolated": rejected — the object covers 9.2% of the photo (< 12%)
- pixabay "justice scale isolated": verify CLOSE — saw "Lady Justice statue holding scales"

## scientist

- pixabay "scientist isolated": verify CLOSE — saw "a statue of a man"
- pixabay "scientist isolated": verify WRONG — saw "a space rocket"
- pixabay "scientist isolated": verify CLOSE — saw "gloved hand holding a test tube with a pipette"

## shield

- pixabay "shield isolated": rejected — the mask runs along the photo's right edge for 62% of it (> 40%): cut by the frame
- pixabay "shield isolated": verify WRONG — saw "red umbrella and laptop with binary code"
- pixabay "shield isolated": rejected — the mask fills 93% of its bounding box (> 92%): a rectangle, not an object
- pixabay "shield isolated": verify WRONG — saw "a man holding a sword"
- pixabay "shield isolated": verify WRONG — saw "a man holding a sword"

## stamp-approved

- pixabay "approved stamp isolated": rejected — the mask fills 93% of its bounding box (> 92%): a rectangle, not an object
- pixabay "approved stamp isolated": verify CLOSE — saw "wooden rubber stamp"
- pixabay "approved stamp isolated": verify WRONG — saw "envelopes with stamps"
- pixabay "approved stamp isolated": verify WRONG — saw "wooden pin stamps"
