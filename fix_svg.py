import os

file_path = 'frontend/src/pages/HomePage.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace feature-icon-svg with standard text colors
content = content.replace('className="feature-icon-svg"', 'className="w-6 h-6 text-white drop-shadow-md"')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed SVGs in HomePage")
