import pytest

from app.ai.schemas import IssueCategory, Priority
from app.services.intelligence import (
    analyze_description,
    calculate_severity,
    corroboration_score,
    haversine_meters,
)


def test_analysis_labels_demo_output_and_routes_supported_category():
    result = analyze_description("A deep pothole on the road near the junction")

    assert result.category == IssueCategory.POTHOLE
    assert result.department.value == "ROAD_MAINTENANCE"
    assert result.hazard_severity == 8.0
    assert result.is_demo_output is True


def test_unclear_description_is_not_promoted_to_a_civic_issue():
    result = analyze_description("A photo of a cloudy sky")

    assert result.category == IssueCategory.OTHER
    assert result.is_valid_civic_issue is False
    assert result.evidence_validity.value == "UNCERTAIN"


@pytest.mark.parametrize(
    ("description", "expected_category"),
    [
        ("Garbage and waste are blocking the street", IssueCategory.GARBAGE),
        ("A water leak is spreading across the road", IssueCategory.WATER_LEAKAGE),
        ("There is an open drain near the crossing", IssueCategory.OPEN_DRAIN),
        ("The broken road surface needs repair", IssueCategory.DAMAGED_ROAD),
    ],
)
def test_demo_classifier_covers_the_other_mvp_categories(description, expected_category):
    assert analyze_description(description).category == expected_category


def test_missing_score_components_are_excluded_and_reported():
    result = calculate_severity(hazard=8.0, corroboration=2.5)

    assert result.final_score == pytest.approx((0.4 * 8 + 0.15 * 2.5) / 0.55)
    assert result.priority == Priority.HIGH
    assert result.has_missing_components is True
    assert result.E.value is None
    assert result.E.available is False


def test_corroboration_has_diminishing_returns_and_distance_is_geographic():
    assert corroboration_score(2) < corroboration_score(4) < corroboration_score(8)
    assert haversine_meters(47.0, -122.0, 47.0, -122.0) == 0
    assert 110 < haversine_meters(0.0, 0.0, 0.0, 0.001) < 112
