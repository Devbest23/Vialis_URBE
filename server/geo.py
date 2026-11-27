import math


def nearest_road_point(lat, lng, roads):
    meters_per_lat = 111_320
    meters_per_lng = meters_per_lat * math.cos(math.radians(lat))
    best_road = None
    best_point = None
    best_distance = float("inf")

    for road in roads:
        points = road.get("points") or []
        for start, end in zip(points, points[1:]):
            ax = (start[1] - lng) * meters_per_lng
            ay = (start[0] - lat) * meters_per_lat
            bx = (end[1] - lng) * meters_per_lng
            by = (end[0] - lat) * meters_per_lat
            dx, dy = bx - ax, by - ay
            length_squared = dx * dx + dy * dy
            amount = max(0, min(1, -(ax * dx + ay * dy) / length_squared)) if length_squared else 0
            projected_lat = start[0] + (end[0] - start[0]) * amount
            projected_lng = start[1] + (end[1] - start[1]) * amount
            distance = math.hypot(ax + amount * dx, ay + amount * dy)
            if distance < best_distance:
                best_road = road
                best_point = (projected_lat, projected_lng)
                best_distance = distance

    return best_road, best_point, best_distance
