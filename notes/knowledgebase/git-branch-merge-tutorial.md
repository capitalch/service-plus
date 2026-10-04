# Git Branch & Merge Tutorial

## 1. Check your current branch
```bash
git branch
```
The branch you're on is marked with `*`.

## 2. Create a new branch
```bash
git branch feature-login
```
This creates a branch but doesn't switch to it.

## 3. Switch to the branch
```bash
git checkout feature-login
```
Or create and switch in one step:
```bash
git checkout -b feature-login
```
(Modern alternative: `git switch -c feature-login`)

## 4. Make changes and commit
```bash
# edit some files
git add .
git commit -m "Add login feature"
```
These commits exist only on `feature-login` — your `main` branch is untouched.

## 5. Switch back to main
```bash
git checkout main
```

## 6. Merge the feature branch into main
```bash
git merge feature-login
```
- If `main` hasn't changed since you branched off, this is a **fast-forward** merge (just moves the pointer).
- If `main` has new commits too, Git creates a **merge commit** combining both histories.

## 7. Handle conflicts (if any)
If both branches edited the same lines, Git will pause and mark the conflict in the file:
```
<<<<<<< HEAD
your main branch code
=======
your feature branch code
>>>>>>> feature-login
```
Edit the file to resolve it, then:
```bash
git add <file>
git commit
```

## 8. Delete the branch (optional cleanup)
```bash
git branch -d feature-login
```

## Quick mental model
- **Branch** = a movable pointer to a commit, letting you work in isolation.
- **Merge** = bringing another branch's commits into your current branch.

A common workflow: `main` stays stable, you branch for each feature/fix, then merge back in via pull request once it's tested.
