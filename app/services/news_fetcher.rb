# app/services/news_fetcher.rb
require "feedjira"
require "net/http"
require "uri"
require "openssl"

class NewsFetcher
  ANN_RSS = "https://www.animenewsnetwork.com/all/rss.xml?ann-edition=us".freeze

  def self.refresh
    Rails.logger.info "🌿 NewsFetcher: starting refresh..."
    fetch_ann
    Rails.logger.info "✅ NewsFetcher: #{Article.count} total articles in archive"
  rescue => e
    Rails.logger.error "NewsFetcher.refresh failed: #{e.message}"
  end

  private

  def self.fetch_ann
    Rails.logger.info "📡 Fetching ANN RSS..."

    body = fetch_with_redirects(ANN_RSS)

    unless body
      Rails.logger.error "ANN RSS: empty response after redirects"
      return
    end

    Rails.logger.info "ANN RSS fetched: #{body.bytesize} bytes"

    feed  = Feedjira.parse(body)
    saved = 0

    feed.entries.first(57).each do |entry|
      next if entry.url.blank? || entry.title.blank?

      Article.find_or_create_by(url: entry.url.strip) do |article|
        article.title        = entry.title.truncate(255)
        article.summary      = clean_html(entry.summary || entry.content || "")
        article.source_name  = "ANN"
        article.image_url    = entry.try(:image) || entry.try(:enclosure)&.url
        article.published_at = entry.published || Time.current
        article.featured     = false
        saved += 1
      end
    end

    Rails.logger.info "ANN: #{saved} new articles saved"
  rescue => e
    Rails.logger.error "fetch_ann error: #{e.message}"
    Rails.logger.error e.backtrace.first(3).join("\n")
  end

  # Follows 301/302 redirects up to 5 times
  def self.fetch_with_redirects(url, limit = 5)
    raise "Too many redirects" if limit.zero?

    uri  = URI.parse(url)
    http = Net::HTTP.new(uri.host, uri.port)

    if uri.scheme == "https"
      http.use_ssl     = true
      http.verify_mode = OpenSSL::SSL::VERIFY_PEER
      http.cert_store  = build_cert_store
    end

    http.open_timeout = 10
    http.read_timeout = 20

    request = Net::HTTP::Get.new(uri.request_uri)
    request["User-Agent"] = "FrierenArchive/0.1.0 RSS Reader"

    response = http.request(request)

    case response
    when Net::HTTPSuccess
      response.body
    when Net::HTTPRedirection
      new_url = response["location"]
      Rails.logger.info "ANN RSS redirected → #{new_url}"
      fetch_with_redirects(new_url, limit - 1)
    else
      Rails.logger.error "ANN RSS HTTP #{response.code}: #{response.message}"
      nil
    end
  rescue => e
    Rails.logger.error "fetch_with_redirects error: #{e.message}"
    nil
  end

  # Builds a cert store that works on both Windows and Linux/macOS
  def self.build_cert_store
    store = OpenSSL::X509::Store.new
    store.set_default_paths  # uses system certs on Linux/macOS

    # On Windows, system certs aren't auto-loaded — pull from the Windows ROOT store
    if Gem.win_platform?
      require "win32/registry"
      [
        "ROOT",
        "CA"
      ].each do |store_name|
        Win32::Registry::HKEY_LOCAL_MACHINE.open(
          "SOFTWARE\\Microsoft\\SystemCertificates\\#{store_name}\\Certificates"
        ) do |reg|
          reg.each_key do |thumbprint|
            reg.open(thumbprint) do |cert_reg|
              der = cert_reg["Blob"] rescue next
              cert = OpenSSL::X509::Certificate.new(der) rescue next
              store.add_cert(cert) rescue nil
            end
          end
        end
      rescue Win32::Registry::Error
        next
      end
    end

    store
  end

  def self.clean_html(html)
    ActionController::Base.helpers
                          .strip_tags(html)
                          .gsub(/\s+/, " ")
                          .strip
                          .truncate(300)
  rescue
    html.to_s.truncate(300)
  end
end
