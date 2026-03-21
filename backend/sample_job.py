import sys
import time


print("ComputeBnB sample job starting")

for step in range(1, 4):
    print(f"stdout step {step}/3")
    time.sleep(1)

print("sample warning on stderr", file=sys.stderr)
print("ComputeBnB sample job done")
