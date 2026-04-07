# Simplified Appium Docker Container
# Base image already has Appium, Node.js, and most dependencies
FROM appium/appium:latest

# Set environment variables
ENV ANDROID_HOME=/opt/android
ENV PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools

# Expose Appium port
EXPOSE 4723

# Start Appium server with permissive settings for development
CMD ["appium", "--address", "0.0.0.0", "--port", "4723", "--allow-insecure", "adb_shell", "--base-path", "/"]
