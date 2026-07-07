from accounts.services import sanitize_display_name


def test_valid_nick_passes_through():
    assert sanitize_display_name("Ana Maria_2") == "Ana Maria_2"


def test_accented_letters_are_allowed():
    assert sanitize_display_name("João") == "João"


def test_empty_or_blank_falls_back():
    assert sanitize_display_name("") == "guest"
    assert sanitize_display_name("   ") == "guest"


def test_html_or_script_falls_back():
    assert sanitize_display_name("<script>alert(1)</script>") == "guest"


def test_control_characters_fall_back():
    assert sanitize_display_name("nick\x00\x07") == "guest"


def test_too_long_falls_back():
    assert sanitize_display_name("a" * 33) == "guest"


def test_non_string_falls_back():
    assert sanitize_display_name(None) == "guest"
    assert sanitize_display_name(123) == "guest"


def test_custom_fallback_is_used():
    assert sanitize_display_name("<bad>", fallback="daniel") == "daniel"


def test_surrounding_whitespace_is_trimmed():
    assert sanitize_display_name("  Ana  ") == "Ana"
