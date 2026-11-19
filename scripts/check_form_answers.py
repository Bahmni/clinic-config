#!/usr/bin/env python3
"""Fail if any Bahmni form has an answers list with the same concept UUID twice.

Usage: check_form_answers.py <directory-with-form-json-files>

Form Builder exports keep the form definition as a JSON string in
formJson.resources[0].value, so that string is decoded before walking it.
"""
import json
import os
import sys


def load_form(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict) and "formJson" in data:
        return json.loads(data["formJson"]["resources"][0]["value"])
    return data


def find_answer_lists(node, path=""):
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "answers" and isinstance(value, list) and value and isinstance(value[0], dict) and "uuid" in value[0]:
                yield f"{path}/{key}", value
            yield from find_answer_lists(value, f"{path}/{key}")
    elif isinstance(node, list):
        for i, value in enumerate(node):
            yield from find_answer_lists(value, f"{path}/{i}")


def check_file(path):
    try:
        form = load_form(path)
    except (OSError, ValueError, KeyError, IndexError) as error:
        return [f"cannot parse form: {error}"]
    problems = []
    for where, answers in find_answer_lists(form):
        uuids = [answer["uuid"] for answer in answers]
        repeated = sorted({u for u in uuids if uuids.count(u) > 1})
        for uuid in repeated:
            problems.append(f"{where}: answer {uuid} appears {uuids.count(uuid)} times")
    return problems


def main(directory):
    failed = False
    for name in sorted(os.listdir(directory)):
        if not name.endswith(".json"):
            continue
        path = os.path.join(directory, name)
        for problem in check_file(path):
            failed = True
            print(f"{path}: {problem}")
    if failed:
        print("Duplicate or unreadable answers found. Keep one entry per UUID.")
        return 1
    print(f"OK: no duplicate answers in {directory}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
