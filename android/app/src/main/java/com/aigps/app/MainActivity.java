package com.aigps.app;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.location.GnssStatus;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.Locale;

public class MainActivity extends Activity implements LocationListener {
    private static final int LOCATION_REQUEST = 1001;

    private LocationManager locationManager;
    private TextView status;
    private TextView coords;
    private TextView accuracy;
    private TextView speed;
    private TextView bearing;
    private TextView provider;
    private TextView satellites;
    private TextView note;

    private final GnssStatus.Callback gnssCallback = new GnssStatus.Callback() {
        @Override
        public void onSatelliteStatusChanged(GnssStatus s) {
            int visible = s.getSatelliteCount();
            int used = 0;
            float cn0Total = 0f;
            int cn0Count = 0;
            for (int i = 0; i < visible; i++) {
                if (s.usedInFix(i)) used++;
                float cn0 = s.getCn0DbHz(i);
                if (cn0 > 0) {
                    cn0Total += cn0;
                    cn0Count++;
                }
            }
            float avg = cn0Count == 0 ? 0f : cn0Total / cn0Count;
            satellites.setText(String.format(Locale.US,
                    "Satellites\n%d visible • %d used\n%.1f dB-Hz avg", visible, used, avg));
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(buildUi());
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        startLocation();
    }

    private LinearLayout buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(20), dp(20), dp(20));
        root.setBackgroundColor(Color.rgb(9, 13, 21));

        TextView title = text("AiGPS", 30, Color.WHITE, true);
        TextView subtitle = text("LIVE GNSS DIAGNOSTIC BUILD", 12, Color.rgb(56, 189, 248), true);
        status = text("Requesting precise location…", 16, Color.rgb(226, 232, 240), true);
        coords = card("Coordinates\nWaiting for fix…");
        accuracy = card("Accuracy\n—");
        speed = card("Speed\n—");
        bearing = card("Bearing\n—");
        provider = card("Provider\n—");
        satellites = card("Satellites\nWaiting for GNSS…");
        note = text(
                "This build reports real phone GNSS data. It does not claim an exact lane until real lane geometry and confidence gates are connected.",
                13, Color.rgb(148, 163, 184), false);

        root.addView(title);
        root.addView(subtitle);
        addSpace(root, 18);
        root.addView(status);
        addSpace(root, 12);
        root.addView(coords);
        root.addView(accuracy);
        root.addView(speed);
        root.addView(bearing);
        root.addView(provider);
        root.addView(satellites);
        addSpace(root, 16);
        root.addView(note);
        return root;
    }

    private TextView card(String value) {
        TextView v = text(value, 18, Color.WHITE, false);
        v.setPadding(dp(16), dp(14), dp(16), dp(14));
        v.setBackgroundColor(Color.rgb(18, 25, 39));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, dp(6), 0, dp(6));
        v.setLayoutParams(lp);
        return v;
    }

    private TextView text(String value, int sp, int color, boolean bold) {
        TextView v = new TextView(this);
        v.setText(value);
        v.setTextSize(sp);
        v.setTextColor(color);
        v.setGravity(Gravity.START);
        if (bold) v.setTypeface(v.getTypeface(), android.graphics.Typeface.BOLD);
        return v;
    }

    private void addSpace(LinearLayout parent, int heightDp) {
        TextView spacer = new TextView(this);
        spacer.setHeight(dp(heightDp));
        parent.addView(spacer);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void startLocation() {
        if (Build.VERSION.SDK_INT >= 23 &&
                checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
            }, LOCATION_REQUEST);
            return;
        }

        boolean locationOn = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER);
        if (!locationOn) {
            status.setText("System Location/GPS is OFF");
            note.setText("Turn on Location, then reopen AiGPS.");
            return;
        }

        status.setText("GNSS fix: waiting…");
        try {
            locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 500L, 0f, this);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                locationManager.registerGnssStatusCallback(gnssCallback);
            }
        } catch (SecurityException e) {
            status.setText("Precise location permission required");
        }
    }

    @Override
    public void onLocationChanged(Location location) {
        status.setText(location.hasAccuracy() && location.getAccuracy() <= 8f
                ? "GNSS fix: HIGH ACCURACY"
                : "GNSS fix: OK");

        coords.setText(String.format(Locale.US, "Coordinates\n%.7f, %.7f",
                location.getLatitude(), location.getLongitude()));
        accuracy.setText(String.format(Locale.US, "Accuracy\n%.1f m",
                location.hasAccuracy() ? location.getAccuracy() : 0f));
        speed.setText(String.format(Locale.US, "Speed\n%.1f mph",
                location.hasSpeed() ? location.getSpeed() * 2.236936f : 0f));
        bearing.setText(String.format(Locale.US, "Bearing\n%.0f°",
                location.hasBearing() ? location.getBearing() : 0f));
        provider.setText("Provider\n" + location.getProvider());
    }

    @Override
    public void onProviderEnabled(String p) {
        status.setText("GPS enabled — waiting for fix…");
    }

    @Override
    public void onProviderDisabled(String p) {
        status.setText("GPS provider disabled");
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {
        // Required on older Android versions.
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_REQUEST && grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            startLocation();
        } else {
            status.setText("Location permission denied");
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (locationManager != null) {
            try {
                locationManager.removeUpdates(this);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    locationManager.unregisterGnssStatusCallback(gnssCallback);
                }
            } catch (Exception ignored) {
            }
        }
    }
}
