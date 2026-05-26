import html

import pytest


def _describe_test(nodeid: str) -> str:
    name = nodeid.rsplit("::", 1)[-1]
    if name.startswith("test_"):
        name = name[5:]
    return name.replace("_", " ")


def pytest_html_results_table_header(cells):
    cells.insert(2, "<th>Description</th>")
    cells.insert(3, "<th>Path</th>")


def pytest_html_results_table_row(report, cells):
    description = getattr(report, "description", _describe_test(report.nodeid))
    cells.insert(2, f"<td>{html.escape(description)}</td>")
    cells.insert(3, f"<td>{html.escape(report.nodeid)}</td>")


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    report.description = item.function.__doc__ or _describe_test(item.nodeid)
