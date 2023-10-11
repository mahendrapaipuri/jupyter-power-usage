from mock import MagicMock
from mock import patch


class TestBasic:
    """Some basic tests, checking import, making sure APIs remain consistent, etc"""

    def test_import_serverextension(self):
        """Check that serverextension hooks are available"""
        from jupyter_power_usage import (
            _jupyter_labextension_paths,
            load_jupyter_server_extension,
        )

        assert _jupyter_labextension_paths() == [
            {"src": "labextension", "dest": "@mahendrapaipuri/jupyter-power-usage"}
        ]

        # mock a notebook app
        nbapp_mock = MagicMock()
        nbapp_mock.web_app.settings = {"base_url": ""}

        # mock these out for unit test
        with patch("jupyter_power_usage.PowerUsageDisplay") as power_use_display_mock:
            # load up with mock
            load_jupyter_server_extension(nbapp_mock)

            # assert that we installed the application in settings
            print(nbapp_mock.web_app.settings)
            assert "jupyter_power_usage_config" in nbapp_mock.web_app.settings
