# -*- coding: utf-8 -*-
#
# Copyright (c) 2025 CanhCamsSolutions
# All rights reserved.
# Licensed under the CanhCamsSolutions Proprietary License.
#
# You may modify the source code for internal use only,
# but you may NOT remove or alter the author or company name.
# Commercial use, resale, or redistribution is strictly prohibited.
#
# See LICENSE file for full license terms.

import json
import logging
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from . import models
from . import controllers
from . import data
from odoo.api import Environment, SUPERUSER_ID
_logger = logging.getLogger(__name__)

def setup_user_account(env):
    _logger.info("=== Running setup_user_account ===")

    # === Tìm menu "Leandix AI" và luôn cập nhật Web Icon File ===
    try:
        menu_name = "Leandix AI"
        icon_path = "leandix_ai_base,static/description/icon.png"
        menu = env['ir.ui.menu'].sudo().search([('name', '=', menu_name)], limit=1)

        if menu:
            menu.write({'web_icon': icon_path})
            _logger.info("Đã ghi đè Web Icon File thành '%s' cho menu '%s'", icon_path, menu_name)
        else:
            _logger.info("Menu '%s' chưa tồn tại", menu_name)
    except Exception as e:
        _logger.warning("Không thể cập nhật Web Icon File: %s", e)

    url = "https://api.leandix.com/create_key"
    # url = "http://chat_engine-back_end-1:5000/create_key"

    try:
        headers = {
            "User-Agent": "Mozilla/5.0",
            "Accept": "*/*",
            "Connection": "keep-alive",
            "Cache-Control": "no-cache"
        }
        request = Request(url, headers=headers, method='GET')
        with urlopen(request) as response:
            if response.status == 200:
                _logger.info(" - response = %s", response)
                raw_data = response.read().decode("utf-8")
                _logger.info(" - raw_data = %s", raw_data)
                data = json.loads(raw_data)
                _logger.info(" - data  = %s", data)
                api_key = data.get("API_key")
                api_id = data.get("API_id")

                if api_key and api_id:
                    config = env['ir.config_parameter'].sudo()
                    config.set_param("API_key", api_key)
                    config.set_param("API_id", str(api_id))

                    _logger.info(" API Key created and saved:")
                    _logger.info(" - API_key = %s", api_key)
                    _logger.info(" - API_id  = %s", api_id)
                else:
                    _logger.warning(" API response missing API_key or API_id")
            else:
                _logger.error(" HTTP Error: Status %s", response.status)

    except HTTPError as e:
        _logger.error(" HTTPError: %s - %s", e.code, e.reason)
    except URLError as e:
        _logger.error(" URLError: %s", e.reason)
    except Exception as e:
        _logger.exception(" Unexpected error calling external API")

    # === In toàn bộ config parameters (tuỳ chọn) ===
    config_params = env['ir.config_parameter'].sudo().search([])
    for param in config_params:
        _logger.info("Param: %s = %s", param.key, param.value)




def uninstall_user_account(env):  # ✅ đúng chữ ký
    _logger.info("=== Running uninstall_user_account ===")

    try:
        # ✅ Dùng trực tiếp env
        config = env['ir.config_parameter'].sudo()
        removed_keys = []

        for key in ["API_key", "API_id"]:
            if config.get_param(key):
                config.set_param(key, "")
                removed_keys.append(key)

        if removed_keys:
            _logger.info("Đã xoá config keys: %s", removed_keys)
        else:
            _logger.info("Không có config key nào để xoá")

        # --- Xoá web_icon trên menu "Leandix AI" ---
        menu_name = "Leandix AI"
        menu = env['ir.ui.menu'].sudo().search([('name', '=', menu_name)], limit=1)
        if menu:
            menu.write({'web_icon': False})
            _logger.info("Đã xoá web_icon khỏi menu '%s'", menu_name)
        else:
            _logger.info("Không tìm thấy menu '%s'", menu_name)

    except Exception as e:
        _logger.exception("Lỗi khi xoá cấu hình trong uninstall_user_account")
    _logger.info("=== Running uninstall_user_account ===")

    try:
        # ✅ Dùng trực tiếp env
        config = env['ir.config_parameter'].sudo()
        removed_keys = []

        for key in ["API_key", "API_id"]:
            if config.get_param(key):
                config.set_param(key, "")
                removed_keys.append(key)

        if removed_keys:
            _logger.info("Đã xoá config keys: %s", removed_keys)
        else:
            _logger.info("Không có config key nào để xoá")

        # --- Xoá web_icon trên menu "Leandix AI" ---
        menu_name = "Leandix AI"
        menu = env['ir.ui.menu'].sudo().search([('name', '=', menu_name)], limit=1)
        if menu:
            menu.write({'web_icon': False})
            _logger.info("Đã xoá web_icon khỏi menu '%s'", menu_name)
        else:
            _logger.info("Không tìm thấy menu '%s'", menu_name)

    except Exception as e:
        _logger.exception("Lỗi khi xoá cấu hình trong uninstall_user_account")

    _logger.info("=== Running uninstall_user_account ===")

    try:
        # --- Xoá các config param đã tạo ---
        config = env['ir.config_parameter'].sudo()
        removed_keys = []

        for key in ["API_key", "API_id"]:
            if config.get_param(key):
                config.set_param(key, "")
                removed_keys.append(key)

        if removed_keys:
            _logger.info("Đã xoá config keys: %s", removed_keys)
        else:
            _logger.info("Không có config key nào để xoá")

        # --- Xoá web_icon trên menu "Leandix AI" ---
        menu_name = "Leandix AI"
        menu = env['ir.ui.menu'].sudo().search([('name', '=', menu_name)], limit=1)
        if menu:
            menu.write({'web_icon': False})
            _logger.info("Đã xoá web_icon khỏi menu '%s'", menu_name)
        else:
            _logger.info("Không tìm thấy menu '%s'", menu_name)

    except Exception as e:
        _logger.exception("Lỗi khi xoá cấu hình trong uninstall_user_account")
    _logger.info("=== Running uninstall_user_account ===")

    try:
        # --- Xoá các config param đã tạo ---
        config = env['ir.config_parameter'].sudo()
        removed_keys = []

        for key in ["API_key", "API_id"]:
            if config.get_param(key):
                config.set_param(key, "")
                removed_keys.append(key)

        if removed_keys:
            _logger.info("Đã xoá config keys: %s", removed_keys)
        else:
            _logger.info("Không có config key nào để xoá")

        # --- Xoá web_icon trên menu "Leandix AI" (reset lại nếu muốn) ---
        menu_name = "Leandix AI"
        menu = env['ir.ui.menu'].sudo().search([('name', '=', menu_name)], limit=1)
        if menu:
            menu.write({'web_icon': False})
            _logger.info("Đã xoá web_icon khỏi menu '%s'", menu_name)
        else:
            _logger.info("Không tìm thấy menu '%s'", menu_name)

    except Exception as e:
        _logger.exception("Lỗi khi xoá cấu hình trong uninstall_user_account")