"""Fast smoke test: load, wait 2s, screenshot, fail on console/page errors or missing hook."""
import sys
import time

import harness


def main():
    with harness.session() as s:
        time.sleep(2)
        print("screenshot:", harness.shot(s.page, "smoke"))
        if not any("__sammy" in e for e in s.errors):
            print("state:", harness.state(s.page))
    if s.errors:
        print("FAIL")
        for e in s.errors:
            print(" ", e)
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
