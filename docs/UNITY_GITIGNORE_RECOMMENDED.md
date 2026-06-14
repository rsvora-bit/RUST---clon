# Doporučený Unity .gitignore

Soubor `.gitignore` v repozitáři už pravděpodobně existuje, protože pokus o vytvoření nového `.gitignore` GitHub odmítl s tím, že by bylo potřeba dodat SHA existujícího souboru. Níže je doporučený obsah, který má být v root `.gitignore`.

```gitignore
# Unity generated folders
[Ll]ibrary/
[Tt]emp/
[Oo]bj/
[Bb]uild/
[Bb]uilds/
[Ll]ogs/
[Uu]ser[Ss]ettings/
[Mm]emoryCaptures/

# Unity cache / generated files
*.csproj
*.sln
*.suo
*.tmp
*.user
*.userprefs
*.pidb
*.booproj
*.svd
*.pdb
*.mdb
*.opendb
*.VC.db

# OS files
.DS_Store
Thumbs.db

# IDE folders
.vscode/
.idea/

# Keep these tracked in Unity projects
!Assets/**/*.meta
!ProjectSettings/**/*.asset
!Packages/manifest.json
!Packages/packages-lock.json
```
