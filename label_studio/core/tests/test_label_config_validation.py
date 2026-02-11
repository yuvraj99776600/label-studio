"""This file and its contents are licensed under the Apache License 2.0. Please see the included NOTICE for copyright information and LICENSE for a copy of the license.
"""
import pytest
from rest_framework.exceptions import ValidationError

from label_studio.core.label_config import validate_label_config


class TestVideoPlaybackSpeedValidation:
    """Tests for Video tag playback speed parameter validation"""

    def test_video_min_speed_greater_than_default_should_fail(self):
        """Test that minPlaybackSpeed > defaultPlaybackSpeed raises ValidationError"""
        config = """
        <View>
            <Video name="video" value="$video" minPlaybackSpeed="10" defaultPlaybackSpeed="5" />
        </View>
        """

        with pytest.raises(ValidationError) as exc_info:
            validate_label_config(config)

        error_message = str(exc_info.value.detail[0])
        assert 'minPlaybackSpeed' in error_message
        assert 'defaultPlaybackSpeed' in error_message
        assert '10' in error_message
        assert '5' in error_message

    def test_video_min_speed_less_than_default_should_pass(self):
        """Test that minPlaybackSpeed < defaultPlaybackSpeed passes validation"""
        config = """
        <View>
            <Video name="video" value="$video" minPlaybackSpeed="5" defaultPlaybackSpeed="10" />
        </View>
        """

        # Should not raise any exception
        validate_label_config(config)

    def test_video_min_speed_equal_to_default_should_pass(self):
        """Test that minPlaybackSpeed == defaultPlaybackSpeed passes validation"""
        config = """
        <View>
            <Video name="video" value="$video" minPlaybackSpeed="5" defaultPlaybackSpeed="5" />
        </View>
        """

        # Should not raise any exception
        validate_label_config(config)

    def test_video_with_only_min_speed_should_pass(self):
        """Test that Video with only minPlaybackSpeed passes validation"""
        config = """
        <View>
            <Video name="video" value="$video" minPlaybackSpeed="5" />
        </View>
        """

        # Should not raise any exception
        validate_label_config(config)

    def test_video_with_only_default_speed_should_pass(self):
        """Test that Video with only defaultPlaybackSpeed passes validation"""
        config = """
        <View>
            <Video name="video" value="$video" defaultPlaybackSpeed="5" />
        </View>
        """

        # Should not raise any exception
        validate_label_config(config)

    def test_video_with_no_speed_params_should_pass(self):
        """Test that Video without speed parameters passes validation"""
        config = """
        <View>
            <Video name="video" value="$video" />
        </View>
        """

        # Should not raise any exception
        validate_label_config(config)

    def test_video_with_invalid_numeric_values_should_pass(self):
        """Test that Video with non-numeric values skips validation gracefully"""
        config = """
        <View>
            <Video name="video" value="$video" minPlaybackSpeed="invalid" defaultPlaybackSpeed="5" />
        </View>
        """

        # Should not raise any exception (validation skipped for invalid numbers)
        validate_label_config(config)

    def test_multiple_videos_one_invalid_should_fail(self):
        """Test that validation catches invalid speeds in multiple Video tags"""
        config = """
        <View>
            <Video name="video1" value="$video1" minPlaybackSpeed="1" defaultPlaybackSpeed="2" />
            <Video name="video2" value="$video2" minPlaybackSpeed="10" defaultPlaybackSpeed="5" />
        </View>
        """

        with pytest.raises(ValidationError) as exc_info:
            validate_label_config(config)

        error_message = str(exc_info.value.detail[0])
        assert 'video2' in error_message
        assert 'minPlaybackSpeed' in error_message

    def test_video_with_decimal_values_should_validate(self):
        """Test that Video with decimal speed values validates correctly"""
        config = """
        <View>
            <Video name="video" value="$video" minPlaybackSpeed="0.5" defaultPlaybackSpeed="0.25" />
        </View>
        """

        with pytest.raises(ValidationError) as exc_info:
            validate_label_config(config)

        error_message = str(exc_info.value.detail[0])
        assert '0.5' in error_message
        assert '0.25' in error_message

    def test_video_with_labels_and_invalid_speed_should_fail(self):
        """Test that complex config with Labels and invalid Video speeds fails"""
        config = """
        <View>
            <Labels name="videoLabel" toName="video" allowEmpty="true">
                <Label value="Man" background="blue"/>
                <Label value="Woman" background="red"/>
                <Label value="Other" background="green"/>
            </Labels>
            <Video name="video" value="$video" minPlaybackSpeed="6" defaultPlaybackSpeed="5" />
        </View>
        """

        with pytest.raises(ValidationError) as exc_info:
            validate_label_config(config)

        error_message = str(exc_info.value.detail[0])
        assert 'minPlaybackSpeed' in error_message
        assert '6' in error_message

    def test_video_min_speed_exceeds_maximum_should_fail(self):
        """Test that minPlaybackSpeed > 10 raises ValidationError"""
        config = """
        <View>
            <Video name="video" value="$video" minPlaybackSpeed="15" />
        </View>
        """

        with pytest.raises(ValidationError) as exc_info:
            validate_label_config(config)

        error_message = str(exc_info.value.detail[0])
        assert 'minPlaybackSpeed' in error_message
        assert '15' in error_message
        assert 'cannot be greater than 10' in error_message

    def test_video_default_speed_exceeds_maximum_should_fail(self):
        """Test that defaultPlaybackSpeed > 10 raises ValidationError"""
        config = """
        <View>
            <Video name="video" value="$video" defaultPlaybackSpeed="20" />
        </View>
        """

        with pytest.raises(ValidationError) as exc_info:
            validate_label_config(config)

        error_message = str(exc_info.value.detail[0])
        assert 'defaultPlaybackSpeed' in error_message
        assert '20' in error_message
        assert 'cannot be greater than 10' in error_message

    def test_video_both_speeds_exceed_maximum_should_fail(self):
        """Test that both speeds > 10 raises ValidationError (catches first violation)"""
        config = """
        <View>
            <Video name="video" value="$video" minPlaybackSpeed="12" defaultPlaybackSpeed="15" />
        </View>
        """

        with pytest.raises(ValidationError) as exc_info:
            validate_label_config(config)

        error_message = str(exc_info.value.detail[0])
        # Should fail on minPlaybackSpeed first (checked before relationship)
        assert 'minPlaybackSpeed' in error_message or 'defaultPlaybackSpeed' in error_message
        assert 'cannot be greater than 10' in error_message

    def test_video_max_valid_speed_should_pass(self):
        """Test that speeds exactly at 10 pass validation"""
        config = """
        <View>
            <Video name="video" value="$video" minPlaybackSpeed="10" defaultPlaybackSpeed="10" />
        </View>
        """

        # Should not raise any exception
        validate_label_config(config)
