require "test_helper"

class Api::HealthControllerTest < ActionDispatch::IntegrationTest
  test "should get index" do
    get api_health_index_url
    assert_response :success
  end
end
